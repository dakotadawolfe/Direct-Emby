import { randomUUID } from "crypto";
import { TtlCache } from "./cache";
import {
  APP_NAME,
  APP_VERSION,
  AddonConfig,
  CatalogExtra,
  EmbyAuthResult,
  EmbyItem,
  EmbyItemsResponse,
  EmbyLibrary,
  EmbyMediaSource,
  FetchLike
} from "./types";

export class EmbyApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "EmbyApiError";
  }
}

interface EmbyClientOptions {
  fetchImpl?: FetchLike;
  cacheTtlMs: number;
}

interface ItemQuery {
  parentId?: string;
  includeItemTypes: string;
  recursive?: boolean;
  search?: string;
  startIndex?: number;
  limit?: number;
  anyProviderIdEquals?: string;
  fields?: string;
  sortBy?: string;
  sortOrder?: string;
}

const DEFAULT_FIELDS = [
  "ProviderIds",
  "PrimaryImageAspectRatio",
  "Overview",
  "Genres",
  "PremiereDate",
  "ProductionYear",
  "CommunityRating",
  "OfficialRating",
  "RunTimeTicks",
  "MediaSources"
].join(",");

function normalizeBaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Emby URL must start with http:// or https://");
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
}

function safeJsonBody(value: unknown): string {
  return JSON.stringify(value);
}

function authHeader(): string {
  const escapedVersion = APP_VERSION.replace(/"/g, "");
  return `MediaBrowser Client="${APP_NAME}", Device="${APP_NAME}", DeviceId="${randomUUID()}", Version="${escapedVersion}"`;
}

function appendQuery(url: string, query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized ? `${url}?${serialized}` : url;
}

export function toPublicEmbyUrl(embyUrl: string): string {
  return normalizeBaseUrl(embyUrl);
}

export function buildEmbyUrl(
  embyUrl: string,
  path: string,
  query: Record<string, string | number | boolean | undefined> = {}
): string {
  const normalized = normalizeBaseUrl(embyUrl);
  return appendQuery(`${normalized}${path}`, query);
}

export function buildStaticStreamUrl(config: AddonConfig, itemId: string): string {
  return buildEmbyUrl(config.embyUrl, `/Videos/${encodeURIComponent(itemId)}/stream`, {
    static: "true",
    api_key: config.accessToken
  });
}

export function buildStaticStreamUrlForSource(config: AddonConfig, itemId: string, mediaSourceId?: string): string {
  return buildEmbyUrl(config.embyUrl, `/Videos/${encodeURIComponent(itemId)}/stream`, {
    static: "true",
    MediaSourceId: mediaSourceId,
    api_key: config.accessToken
  });
}

export function buildSdrTranscodeUrl(config: AddonConfig, itemId: string, mediaSourceId?: string): string {
  return buildEmbyUrl(config.embyUrl, `/Videos/${encodeURIComponent(itemId)}/master.m3u8`, {
    Container: "ts",
    DeviceId: `DirectEmby-${config.createdAt}`,
    MediaSourceId: mediaSourceId,
    VideoCodec: "h264",
    MaxVideoBitDepth: 8,
    EnableAutoStreamCopy: false,
    Static: false,
    api_key: config.accessToken
  });
}

export function buildImageUrl(config: AddonConfig, itemId: string, imageType: "Primary" | "Backdrop" = "Primary"): string {
  return buildEmbyUrl(config.embyUrl, `/Items/${encodeURIComponent(itemId)}/Images/${imageType}`, {
    api_key: config.accessToken
  });
}

export function canDirectPlay(item: EmbyItem): boolean {
  return Boolean(selectDirectPlayableSource(item));
}

export interface PlaybackSource {
  mediaSource: EmbyMediaSource;
  mode: "direct" | "sdr-transcode";
}

export function selectPlaybackSource(item: EmbyItem, preferSdr = false): PlaybackSource | undefined {
  if (item.IsFolder || item.LocationType === "Virtual") {
    return undefined;
  }

  const sources = item.MediaSources ?? [];
  if (sources.length === 0) {
    return undefined;
  }

  if (preferSdr) {
    const sdrSource = sources.find((source) => isDirectPlayableSource(source) && !isHdrMediaSource(source));
    if (sdrSource) {
      return {
        mediaSource: sdrSource,
        mode: "direct"
      };
    }

    const transcodeSource = sources.find((source) => !isUnsupportedProtocol(source));
    if (transcodeSource) {
      return {
        mediaSource: transcodeSource,
        mode: "sdr-transcode"
      };
    }
  }

  const directSource = selectDirectPlayableSource(item);
  return directSource
    ? {
        mediaSource: directSource,
        mode: "direct"
      }
    : undefined;
}

export function isHdrMediaSource(source: EmbyMediaSource): boolean {
  const values = [
    source.Name,
    source.VideoRange,
    source.VideoRangeType,
    ...((source.MediaStreams ?? []).flatMap((stream) => [
      stream.Type?.toLowerCase() === "video" ? stream.Codec : undefined,
      stream.Type?.toLowerCase() === "video" ? stream.DisplayTitle : undefined,
      stream.Type?.toLowerCase() === "video" ? stream.Title : undefined,
      stream.Type?.toLowerCase() === "video" ? stream.VideoRange : undefined,
      stream.Type?.toLowerCase() === "video" ? stream.VideoRangeType : undefined,
      stream.Type?.toLowerCase() === "video" ? stream.ColorTransfer : undefined,
      stream.Type?.toLowerCase() === "video" ? stream.ColorPrimaries : undefined,
      stream.Type?.toLowerCase() === "video" ? stream.ColorSpace : undefined
    ]) ?? [])
  ];

  return values.some((value) => {
    const normalized = value?.toLowerCase();
    if (!normalized) {
      return false;
    }

    return (
      normalized.includes("hdr") ||
      normalized.includes("dolby vision") ||
      normalized.includes("dovi") ||
      normalized.includes("dvhe") ||
      normalized.includes("hlg") ||
      normalized.includes("smpte2084") ||
      normalized.includes("arib-std-b67") ||
      normalized.includes("bt2020")
    );
  });
}

function selectDirectPlayableSource(item: EmbyItem): EmbyMediaSource | undefined {
  if (item.IsFolder || item.LocationType === "Virtual") {
    return undefined;
  }

  return item.MediaSources?.find(isDirectPlayableSource);
}

function isDirectPlayableSource(source: EmbyMediaSource): boolean {
  const supportedDirectPlay = source.SupportsDirectPlay !== false;
  const supportedDirectStream = source.SupportsDirectStream !== false;
  const hasTranscodingUrl = Boolean(source.TranscodingUrl);
  return supportedDirectPlay && supportedDirectStream && !hasTranscodingUrl && !isUnsupportedProtocol(source);
}

function isUnsupportedProtocol(source: EmbyMediaSource): boolean {
  return source.Protocol?.toLowerCase() === "rtmp";
}

export class EmbyClient {
  private readonly fetchImpl: FetchLike;
  private readonly cache: TtlCache<unknown>;

  constructor(options: EmbyClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache = new TtlCache<unknown>(options.cacheTtlMs);
  }

  async authenticate(embyUrl: string, username: string, password: string): Promise<EmbyAuthResult> {
    const baseUrl = normalizeBaseUrl(embyUrl);
    const response = await this.fetchImpl(buildEmbyUrl(baseUrl, "/Users/AuthenticateByName"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Authorization": authHeader()
      },
      body: safeJsonBody({
        Username: username,
        Pw: password
      })
    });

    const body = await this.parseJson<Record<string, any>>(response, "Emby authentication failed");
    const accessToken = body.AccessToken;
    const userId = body.User?.Id;
    if (typeof accessToken !== "string" || typeof userId !== "string") {
      throw new EmbyApiError("Emby authentication response was missing a token or user id");
    }

    return {
      accessToken,
      userId
    };
  }

  async getLibraries(session: AddonConfig | { embyUrl: string; accessToken: string; userId: string }): Promise<EmbyLibrary[]> {
    const body = await this.getJson<EmbyItemsResponse>(
      session,
      `/Users/${encodeURIComponent(session.userId)}/Views`,
      {},
      `libraries:${session.embyUrl}:${session.userId}`
    );

    return (body.Items ?? [])
      .filter((item) => item.CollectionType === "movies" || item.CollectionType === "tvshows")
      .map((item) => ({
        id: item.Id,
        name: item.Name ?? item.Id,
        collectionType: item.CollectionType
      }));
  }

  async getCatalogItems(config: AddonConfig, type: "movie" | "series", extra: CatalogExtra, limit = 50): Promise<EmbyItem[]> {
    const libraryIds = type === "movie" ? config.movieLibraryIds : config.seriesLibraryIds;
    const includeItemTypes = type === "movie" ? "Movie" : "Series";
    return this.queryAcrossLibraries(config, libraryIds, {
      includeItemTypes,
      recursive: true,
      search: extra.search,
      startIndex: extra.skip,
      limit,
      fields: DEFAULT_FIELDS,
      sortBy: "SortName",
      sortOrder: "Ascending"
    });
  }

  async findMovie(config: AddonConfig, stremioId: string): Promise<EmbyItem | undefined> {
    if (stremioId.startsWith("directemby_movie_")) {
      const item = await this.getItem(config, stremioId.slice("directemby_movie_".length));
      return item?.Type === "Movie" ? item : undefined;
    }

    return this.findFirstByProviderId(config, config.movieLibraryIds, "Movie", stremioId);
  }

  async findSeries(config: AddonConfig, stremioId: string): Promise<EmbyItem | undefined> {
    if (stremioId.startsWith("directemby_series_")) {
      const item = await this.getItem(config, stremioId.slice("directemby_series_".length));
      return item?.Type === "Series" ? item : undefined;
    }

    return this.findFirstByProviderId(config, config.seriesLibraryIds, "Series", stremioId);
  }

  async getItem(config: AddonConfig, itemId: string): Promise<EmbyItem | undefined> {
    const body = await this.getJson<EmbyItem>(
      config,
      `/Users/${encodeURIComponent(config.userId)}/Items/${encodeURIComponent(itemId)}`,
      {
        Fields: DEFAULT_FIELDS
      },
      `item:${config.embyUrl}:${config.userId}:${itemId}`
    );
    return body?.Id ? body : undefined;
  }

  async getSeriesEpisodes(config: AddonConfig, seriesId: string): Promise<EmbyItem[]> {
    const body = await this.getJson<EmbyItemsResponse>(
      config,
      `/Shows/${encodeURIComponent(seriesId)}/Episodes`,
      {
        UserId: config.userId,
        Fields: DEFAULT_FIELDS
      },
      `episodes:${config.embyUrl}:${config.userId}:${seriesId}`
    );
    return body.Items ?? [];
  }

  private async findFirstByProviderId(
    config: AddonConfig,
    libraryIds: string[],
    includeItemTypes: string,
    imdbId: string
  ): Promise<EmbyItem | undefined> {
    if (!/^tt\d+$/i.test(imdbId)) {
      return undefined;
    }

    const items = await this.queryAcrossLibraries(config, libraryIds, {
      includeItemTypes,
      recursive: true,
      anyProviderIdEquals: `imdb.${imdbId.toLowerCase()}`,
      limit: 1,
      fields: DEFAULT_FIELDS
    });
    return items[0];
  }

  private async queryAcrossLibraries(config: AddonConfig, libraryIds: string[], query: ItemQuery): Promise<EmbyItem[]> {
    if (libraryIds.length === 0) {
      return [];
    }

    const perLibraryLimit = libraryIds.length > 1 && query.limit != null ? (query.startIndex ?? 0) + query.limit : query.limit;
    const startIndex = libraryIds.length > 1 ? 0 : query.startIndex;
    const allItems: EmbyItem[] = [];
    const seen = new Set<string>();

    for (const libraryId of libraryIds) {
      const body = await this.getJson<EmbyItemsResponse>(
        config,
        `/Users/${encodeURIComponent(config.userId)}/Items`,
        {
          ParentId: libraryId,
          IncludeItemTypes: query.includeItemTypes,
          Recursive: query.recursive ?? true,
          SearchTerm: query.search,
          StartIndex: startIndex,
          Limit: perLibraryLimit,
          AnyProviderIdEquals: query.anyProviderIdEquals,
          Fields: query.fields,
          SortBy: query.sortBy,
          SortOrder: query.sortOrder
        },
        `items:${config.embyUrl}:${config.userId}:${libraryId}:${JSON.stringify({ ...query, startIndex, limit: perLibraryLimit })}`
      );

      for (const item of body.Items ?? []) {
        if (!seen.has(item.Id)) {
          seen.add(item.Id);
          allItems.push(item);
        }
      }
    }

    if (libraryIds.length <= 1) {
      return allItems;
    }

    const skip = query.startIndex ?? 0;
    const limit = query.limit ?? allItems.length;
    return allItems.slice(skip, skip + limit);
  }

  private async getJson<T>(
    session: AddonConfig | { embyUrl: string; accessToken: string; userId: string },
    path: string,
    query: Record<string, string | number | boolean | undefined>,
    cacheKey: string
  ): Promise<T> {
    const cached = this.cache.get(cacheKey) as T | undefined;
    if (cached) {
      return cached;
    }

    const response = await this.fetchImpl(
      buildEmbyUrl(session.embyUrl, path, {
        ...query,
        api_key: session.accessToken
      }),
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      }
    );

    const body = await this.parseJson<T>(response, "Emby request failed");
    this.cache.set(cacheKey, body);
    return body;
  }

  private async parseJson<T>(response: Response, fallbackMessage: string): Promise<T> {
    if (!response.ok) {
      throw new EmbyApiError(fallbackMessage, response.status);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new EmbyApiError("Emby returned an invalid JSON response", response.status);
    }
  }
}
