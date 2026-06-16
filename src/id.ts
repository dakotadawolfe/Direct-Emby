import { EmbyItem } from "./types";

const IMDB_PATTERN = /^tt\d+$/i;
const MOVIE_FALLBACK_PREFIX = "directemby_movie_";
const SERIES_FALLBACK_PREFIX = "directemby_series_";

export interface ParsedEpisodeId {
  seriesKey: string;
  season: number;
  episode: number;
}

export function getImdbId(item: EmbyItem): string | undefined {
  const providerIds = item.ProviderIds ?? {};
  const imdb = providerIds.Imdb ?? providerIds.IMDB ?? providerIds.imdb;
  if (!imdb) {
    return undefined;
  }

  const normalized = imdb.trim();
  return IMDB_PATTERN.test(normalized) ? normalized.toLowerCase() : undefined;
}

export function isImdbId(id: string): boolean {
  return IMDB_PATTERN.test(id);
}

export function movieStremioId(item: EmbyItem): string {
  return getImdbId(item) ?? `${MOVIE_FALLBACK_PREFIX}${item.Id}`;
}

export function seriesStremioId(item: EmbyItem): string {
  return getImdbId(item) ?? `${SERIES_FALLBACK_PREFIX}${item.Id}`;
}

export function episodeStremioId(series: EmbyItem, episode: EmbyItem): string | undefined {
  if (episode.ParentIndexNumber == null || episode.IndexNumber == null) {
    return undefined;
  }

  return `${seriesStremioId(series)}:${episode.ParentIndexNumber}:${episode.IndexNumber}`;
}

export function parseMovieFallbackId(id: string): string | undefined {
  return id.startsWith(MOVIE_FALLBACK_PREFIX) ? id.slice(MOVIE_FALLBACK_PREFIX.length) : undefined;
}

export function parseSeriesFallbackId(id: string): string | undefined {
  return id.startsWith(SERIES_FALLBACK_PREFIX) ? id.slice(SERIES_FALLBACK_PREFIX.length) : undefined;
}

export function parseEpisodeId(id: string): ParsedEpisodeId | undefined {
  const match = id.match(/^(.+):(\d+):(\d+)$/);
  if (!match) {
    return undefined;
  }

  return {
    seriesKey: match[1],
    season: Number(match[2]),
    episode: Number(match[3])
  };
}
