import { describe, expect, it } from "vitest";
import { buildStaticStreamUrl, canDirectPlay } from "../src/emby";
import { episodeStremioId, movieStremioId, seriesStremioId } from "../src/id";
import { AddonConfig, EmbyItem } from "../src/types";

const config: AddonConfig = {
  v: 1,
  embyUrl: "https://emby.example.com",
  accessToken: "token-123",
  userId: "user-1",
  movieLibraryIds: ["movies"],
  seriesLibraryIds: ["series"],
  createdAt: 1
};

describe("Stremio ID mapping", () => {
  it("uses IMDb IDs for movies and series", () => {
    expect(movieStremioId({ Id: "m1", ProviderIds: { Imdb: "tt0111161" } })).toBe("tt0111161");
    expect(seriesStremioId({ Id: "s1", ProviderIds: { Imdb: "tt0944947" } })).toBe("tt0944947");
  });

  it("uses DirectEmby fallback IDs when IMDb IDs are missing", () => {
    expect(movieStremioId({ Id: "m1" })).toBe("directemby_movie_m1");
    expect(seriesStremioId({ Id: "s1" })).toBe("directemby_series_s1");
  });

  it("maps episodes to seriesId:season:episode", () => {
    const series: EmbyItem = { Id: "s1", ProviderIds: { Imdb: "tt0944947" } };
    const episode: EmbyItem = { Id: "e1", ParentIndexNumber: 1, IndexNumber: 1 };
    expect(episodeStremioId(series, episode)).toBe("tt0944947:1:1");
  });
});

describe("direct stream handling", () => {
  it("builds only the static Emby stream URL", () => {
    const url = buildStaticStreamUrl(config, "item-1");
    expect(url).toBe("https://emby.example.com/Videos/item-1/stream?static=true&api_key=token-123");
    expect(url).not.toContain("m3u8");
    expect(url).not.toContain("transcode");
  });

  it("requires a direct playable media source", () => {
    expect(canDirectPlay({ Id: "item", MediaSources: [{ SupportsDirectPlay: true, SupportsDirectStream: true }] })).toBe(true);
    expect(canDirectPlay({ Id: "item", MediaSources: [{ SupportsDirectPlay: false }] })).toBe(false);
    expect(canDirectPlay({ Id: "item", MediaSources: [{ TranscodingUrl: "/Videos/x/master.m3u8" }] })).toBe(false);
    expect(canDirectPlay({ Id: "item" })).toBe(false);
  });
});
