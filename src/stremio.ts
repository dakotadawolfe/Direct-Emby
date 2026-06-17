import {
  APP_NAME,
  APP_VERSION,
  AddonConfig,
  CatalogExtra,
  EmbyItem,
  MOVIE_CATALOG_ID,
  SERIES_CATALOG_ID,
  StremioCatalogMeta,
  StremioContentType,
  StremioMeta,
  StremioStream,
  StremioVideo
} from "./types";
import { buildImageUrl, buildStaticStreamUrlForSource, EmbyClient, selectPlaybackSource } from "./emby";
import { episodeStremioId, movieStremioId, parseEpisodeId, seriesStremioId } from "./id";

export function buildManifest() {
  return {
    id: "community.directemby",
    version: APP_VERSION,
    name: APP_NAME,
    description: "Private DirectEmby addon",
    logo: "",
    resources: [
      {
        name: "catalog",
        types: ["movie"],
        id: MOVIE_CATALOG_ID,
        extra: [
          { name: "search", isRequired: false },
          { name: "skip", isRequired: false }
        ]
      },
      {
        name: "catalog",
        types: ["series"],
        id: SERIES_CATALOG_ID,
        extra: [
          { name: "search", isRequired: false },
          { name: "skip", isRequired: false }
        ]
      },
      "meta",
      "stream"
    ],
    types: ["movie", "series"],
    catalogs: [
      {
        type: "movie",
        id: MOVIE_CATALOG_ID,
        name: "DirectEmby Movies",
        extraSupported: ["search", "skip"]
      },
      {
        type: "series",
        id: SERIES_CATALOG_ID,
        name: "DirectEmby TV Shows",
        extraSupported: ["search", "skip"]
      }
    ],
    idPrefixes: ["tt", "directemby_movie_", "directemby_series_"]
  };
}

export function parseCatalogExtra(rawExtra?: string, query: Record<string, unknown> = {}): CatalogExtra {
  const params = new URLSearchParams(rawExtra ?? "");
  const searchValue = params.get("search") ?? readQueryValue(query.search);
  const skipValue = params.get("skip") ?? readQueryValue(query.skip);
  const skip = Number(skipValue ?? 0);

  return {
    search: searchValue?.trim() || undefined,
    skip: Number.isFinite(skip) && skip > 0 ? Math.floor(skip) : 0
  };
}

export function toCatalogMeta(config: AddonConfig, item: EmbyItem, type: StremioContentType): StremioCatalogMeta {
  return {
    id: type === "movie" ? movieStremioId(item) : seriesStremioId(item),
    type,
    name: item.Name ?? item.OriginalTitle ?? item.Id,
    poster: hasPrimaryImage(item) ? buildImageUrl(config, item.Id, "Primary") : undefined,
    posterShape: "poster",
    background: hasBackdropImage(item) ? buildImageUrl(config, item.Id, "Backdrop") : undefined,
    description: item.Overview,
    year: item.ProductionYear,
    imdbRating: item.CommunityRating != null ? String(item.CommunityRating) : undefined,
    genres: item.Genres
  };
}

export async function buildCatalogResponse(
  emby: EmbyClient,
  config: AddonConfig,
  type: StremioContentType,
  catalogId: string,
  extra: CatalogExtra
): Promise<{ metas: StremioCatalogMeta[] }> {
  if ((type === "movie" && catalogId !== MOVIE_CATALOG_ID) || (type === "series" && catalogId !== SERIES_CATALOG_ID)) {
    return { metas: [] };
  }

  const items = await emby.getCatalogItems(config, type, extra);
  return {
    metas: items.map((item) => toCatalogMeta(config, item, type))
  };
}

export async function buildMetaResponse(
  emby: EmbyClient,
  config: AddonConfig,
  type: StremioContentType,
  id: string
): Promise<{ meta: StremioMeta | null }> {
  if (type === "movie") {
    const movie = await emby.findMovie(config, id);
    return {
      meta: movie ? toDetailedMeta(config, movie, "movie") : null
    };
  }

  const series = await emby.findSeries(config, id);
  if (!series) {
    return { meta: null };
  }

  const episodes = await emby.getSeriesEpisodes(config, series.Id);
  return {
    meta: {
      ...toDetailedMeta(config, series, "series"),
      videos: episodes
        .map((episode) => toEpisodeVideo(config, series, episode))
        .filter((video): video is StremioVideo => Boolean(video))
    }
  };
}

export async function buildStreamResponse(
  emby: EmbyClient,
  config: AddonConfig,
  type: StremioContentType,
  id: string
): Promise<{ streams: StremioStream[] }> {
  if (type === "movie") {
    const movie = await emby.findMovie(config, id);
    if (!movie) {
      return { streams: [] };
    }

    const stream = toStream(config, movie);

    return {
      streams: stream ? [stream] : []
    };
  }

  const parsed = parseEpisodeId(id);
  if (!parsed) {
    return { streams: [] };
  }

  const series = await emby.findSeries(config, parsed.seriesKey);
  if (!series) {
    return { streams: [] };
  }

  const episodes = await emby.getSeriesEpisodes(config, series.Id);
  const episode = episodes.find(
    (candidate) =>
      candidate.SeriesId === series.Id &&
      candidate.ParentIndexNumber === parsed.season &&
      candidate.IndexNumber === parsed.episode
  );

  if (!episode) {
    return { streams: [] };
  }

  const stream = toStream(config, episode);
  return {
    streams: stream ? [stream] : []
  };
}

function toDetailedMeta(config: AddonConfig, item: EmbyItem, type: StremioContentType): StremioMeta {
  return {
    ...toCatalogMeta(config, item, type),
    released: item.PremiereDate,
    runtime: item.RunTimeTicks ? `${Math.round(item.RunTimeTicks / 10_000_000 / 60)} min` : undefined,
    certification: item.OfficialRating
  };
}

function toEpisodeVideo(config: AddonConfig, series: EmbyItem, episode: EmbyItem): StremioVideo | undefined {
  const id = episodeStremioId(series, episode);
  if (!id) {
    return undefined;
  }

  const parts = [
    episode.ParentIndexNumber != null ? `S${String(episode.ParentIndexNumber).padStart(2, "0")}` : undefined,
    episode.IndexNumber != null ? `E${String(episode.IndexNumber).padStart(2, "0")}` : undefined
  ].filter(Boolean);

  return {
    id,
    title: parts.length > 0 ? `${parts.join("")} - ${episode.Name ?? "Episode"}` : episode.Name ?? "Episode",
    season: episode.ParentIndexNumber,
    episode: episode.IndexNumber,
    released: episode.PremiereDate,
    overview: episode.Overview,
    thumbnail: hasPrimaryImage(episode) ? buildImageUrl(config, episode.Id, "Primary") : undefined
  };
}

function toStream(config: AddonConfig, item: EmbyItem): StremioStream | undefined {
  const playback = selectPlaybackSource(item, config.preferSdr === true);
  if (!playback) {
    return undefined;
  }

  const mediaSource = playback.mediaSource;
  const quality = mediaSource?.Bitrate ? `${Math.round(mediaSource.Bitrate / 1_000_000)} Mbps` : undefined;
  const container = mediaSource?.Container?.toUpperCase();
  const details = [container, quality].filter(Boolean).join(" - ");
  const mediaSourceId = config.preferSdr === true ? mediaSource.Id : undefined;

  return {
    name: APP_NAME,
    title: details ? `${APP_NAME}\n${details}` : APP_NAME,
    url: buildStaticStreamUrlForSource(config, item.Id, mediaSourceId),
    behaviorHints: {
      notWebReady: false
    }
  };
}

function hasPrimaryImage(item: EmbyItem): boolean {
  return Boolean(item.ImageTags?.Primary);
}

function hasBackdropImage(item: EmbyItem): boolean {
  return Boolean(item.BackdropImageTags?.length);
}

function readQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
}
