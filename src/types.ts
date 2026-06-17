export const APP_NAME = "DirectEmby";
export const APP_VERSION = "1.0.0";
export const MOVIE_CATALOG_ID = "directemby_movies";
export const SERIES_CATALOG_ID = "directemby_series";

export type StremioContentType = "movie" | "series";

export interface RuntimeConfig {
  port: number;
  encryptionSecret: string;
  publicBaseUrl?: string;
  cacheTtlMs: number;
  setupSessionTtlMs: number;
}

export interface AddonConfig {
  v: 1;
  embyUrl: string;
  accessToken: string;
  userId: string;
  movieLibraryIds: string[];
  seriesLibraryIds: string[];
  preferSdr?: boolean;
  createdAt: number;
}

export interface SetupSession {
  embyUrl: string;
  accessToken: string;
  userId: string;
  createdAt: number;
}

export interface EmbyAuthResult {
  accessToken: string;
  userId: string;
}

export interface EmbyLibrary {
  id: string;
  name: string;
  collectionType?: string;
}

export interface EmbyMediaSource {
  Id?: string;
  Name?: string;
  Protocol?: string;
  Container?: string;
  Size?: number;
  Bitrate?: number;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  TranscodingUrl?: string;
  IsRemote?: boolean;
  VideoRange?: string;
  VideoRangeType?: string;
  MediaStreams?: EmbyMediaStream[];
}

export interface EmbyMediaStream {
  Type?: string;
  Codec?: string;
  DisplayTitle?: string;
  Title?: string;
  VideoRange?: string;
  VideoRangeType?: string;
  ColorTransfer?: string;
  ColorPrimaries?: string;
  ColorSpace?: string;
  BitDepth?: number;
}

export interface EmbyItem {
  Id: string;
  Name?: string;
  OriginalTitle?: string;
  Type?: string;
  ProviderIds?: Record<string, string | undefined>;
  ProductionYear?: number;
  PremiereDate?: string;
  Overview?: string;
  RunTimeTicks?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  Genres?: string[];
  ParentIndexNumber?: number;
  IndexNumber?: number;
  SeriesId?: string;
  SeriesName?: string;
  SeasonName?: string;
  ImageTags?: Record<string, string | undefined>;
  BackdropImageTags?: string[];
  PrimaryImageAspectRatio?: number;
  MediaSources?: EmbyMediaSource[];
  IsFolder?: boolean;
  LocationType?: string;
  CollectionType?: string;
}

export interface EmbyItemsResponse {
  Items?: EmbyItem[];
  TotalRecordCount?: number;
}

export interface StremioCatalogMeta {
  id: string;
  type: StremioContentType;
  name: string;
  poster?: string;
  posterShape?: "poster" | "landscape" | "square";
  background?: string;
  logo?: string;
  description?: string;
  year?: number;
  imdbRating?: string;
  genres?: string[];
}

export interface StremioVideo {
  id: string;
  title: string;
  season?: number;
  episode?: number;
  released?: string;
  overview?: string;
  thumbnail?: string;
}

export interface StremioMeta extends StremioCatalogMeta {
  released?: string;
  runtime?: string;
  certification?: string;
  videos?: StremioVideo[];
}

export interface StremioStream {
  name: string;
  title?: string;
  url: string;
  behaviorHints?: {
    notWebReady?: boolean;
  };
}

export interface CatalogExtra {
  search?: string;
  skip: number;
}

export type FetchLike = typeof fetch;
