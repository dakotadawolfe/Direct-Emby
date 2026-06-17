import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { encryptConfig } from "../src/crypto";
import { AddonConfig, RuntimeConfig } from "../src/types";

const secret = "test-secret-test-secret-test-secret-test-secret";

const runtimeConfig: RuntimeConfig = {
  port: 3000,
  encryptionSecret: secret,
  publicBaseUrl: "https://directemby.example.com",
  cacheTtlMs: 0,
  setupSessionTtlMs: 60_000
};

function addonConfig(overrides: Partial<AddonConfig> = {}): AddonConfig {
  return {
    v: 1,
    embyUrl: "https://emby.example.com",
    accessToken: "token-123",
    userId: "user-1",
    movieLibraryIds: ["movies"],
    seriesLibraryIds: ["series"],
    createdAt: 1,
    ...overrides
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("DirectEmby app", () => {
  it("returns health JSON", async () => {
    const app = createApp({
      config: runtimeConfig,
      fetchImpl: async () => jsonResponse({})
    });

    await request(app).get("/health").expect(200).expect("Content-Type", /json/).expect({
      ok: true,
      name: "DirectEmby",
      version: "1.0.0"
    });
  });

  it("sets CORS headers for Stremio browser fetches", async () => {
    const app = createApp({
      config: runtimeConfig,
      fetchImpl: async () => jsonResponse({})
    });

    await request(app)
      .options("/health")
      .set("Origin", "https://web.stremio.com")
      .expect(204)
      .expect("Access-Control-Allow-Origin", "*")
      .expect("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    await request(app)
      .get("/health")
      .set("Origin", "https://web.stremio.com")
      .expect(200)
      .expect("Access-Control-Allow-Origin", "*");
  });

  it("generates a Stremio install link without returning the password", async () => {
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      if (url.endsWith("/Users/AuthenticateByName")) {
        return jsonResponse({
          AccessToken: "token-from-emby",
          User: { Id: "user-1" }
        });
      }

      if (url.includes("/Users/user-1/Views")) {
        return jsonResponse({
          Items: [
            { Id: "movies", Name: "Movies", CollectionType: "movies" },
            { Id: "series", Name: "Shows", CollectionType: "tvshows" }
          ]
        });
      }

      return jsonResponse({}, 404);
    };

    const app = createApp({ config: runtimeConfig, fetchImpl: fetchImpl as typeof fetch });
    const libraries = await request(app).post("/configure/libraries").send({
      embyUrl: "https://emby.example.com",
      username: "directemby-user",
      password: "not-returned"
    });

    expect(libraries.status).toBe(200);
    expect(libraries.text).not.toContain("not-returned");

    const link = await request(app).post("/configure/link").send({
      setupId: libraries.body.setupId,
      movieLibraryIds: ["movies"],
      seriesLibraryIds: ["series"]
    });

    expect(link.status).toBe(200);
    expect(link.body.installUrl).toMatch(/^stremio:\/\/directemby\.example\.com\/directemby_v1\./);
    expect(link.text).not.toContain("not-returned");
    expect(link.text).not.toContain("token-from-emby");
  });

  it("serves manifest, catalog, and direct movie stream responses", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/Users/user-1/Items") && url.includes("IncludeItemTypes=Movie")) {
        return jsonResponse({
          Items: [
            {
              Id: "movie-1",
              Type: "Movie",
              Name: "The Shawshank Redemption",
              ProviderIds: { Imdb: "tt0111161" },
              MediaSources: [{ Id: "source-1", SupportsDirectPlay: true, SupportsDirectStream: true, Container: "mkv" }]
            }
          ]
        });
      }

      return jsonResponse({}, 404);
    };

    const encrypted = encryptConfig(addonConfig(), secret);
    const app = createApp({ config: runtimeConfig, fetchImpl: fetchImpl as typeof fetch });

    const manifest = await request(app).get(`/${encrypted}/manifest.json`).expect(200);
    expect(manifest.body.catalogs.map((catalog: { name: string }) => catalog.name)).toEqual([
      "DirectEmby Movies",
      "DirectEmby TV Shows"
    ]);
    expect(manifest.body.behaviorHints).toBeUndefined();

    await request(app).get(`/${encrypted}/configure`).expect(302).expect("Location", "/configure");

    const catalog = await request(app).get(`/${encrypted}/catalog/movie/directemby_movies/search=shawshank&skip=0.json`).expect(200);
    expect(catalog.body.metas[0].id).toBe("tt0111161");

    const stream = await request(app).get(`/${encrypted}/stream/movie/tt0111161.json`).expect(200);
    expect(stream.body.streams).toHaveLength(1);
    expect(stream.body.streams[0].url).toBe(
      "https://emby.example.com/Videos/movie-1/stream?static=true&api_key=token-123"
    );
    expect(stream.body.streams[0].url).not.toContain("m3u8");
    expect(calls.some((url) => url.includes("AnyProviderIdEquals=imdb.tt0111161"))).toBe(true);
  });

  it("keeps direct HDR streams when no SDR source is available", async () => {
    const fetchImpl = async (): Promise<Response> =>
      jsonResponse({
        Items: [
          {
            Id: "movie-1",
            Type: "Movie",
            Name: "HDR Movie",
            ProviderIds: { Imdb: "tt0000002" },
            MediaSources: [
              {
                Id: "source-1",
                SupportsDirectPlay: true,
                SupportsDirectStream: true,
                Container: "mkv",
                MediaStreams: [{ Type: "Video", VideoRange: "HDR10" }]
              }
            ]
          }
        ]
      });

    const encrypted = encryptConfig(addonConfig({ preferSdr: true }), secret);
    const app = createApp({ config: runtimeConfig, fetchImpl: fetchImpl as typeof fetch });

    const stream = await request(app).get(`/${encrypted}/stream/movie/tt0000002.json`).expect(200);
    expect(stream.body.streams).toHaveLength(1);
    expect(stream.body.streams[0].url).toBe(
      "https://emby.example.com/Videos/movie-1/stream?static=true&MediaSourceId=source-1&api_key=token-123"
    );
    expect(stream.body.streams[0].url).not.toContain("master.m3u8");
  });

  it("returns an empty stream list when direct play is unavailable", async () => {
    const fetchImpl = async (): Promise<Response> =>
      jsonResponse({
        Items: [
          {
            Id: "movie-1",
            Type: "Movie",
            Name: "Transcode Only",
            ProviderIds: { Imdb: "tt0000001" },
            MediaSources: [{ Id: "source-1", SupportsDirectPlay: false, TranscodingUrl: "/Videos/movie-1/master.m3u8" }]
          }
        ]
      });

    const encrypted = encryptConfig(addonConfig(), secret);
    const app = createApp({ config: runtimeConfig, fetchImpl: fetchImpl as typeof fetch });

    const stream = await request(app).get(`/${encrypted}/stream/movie/tt0000001.json`).expect(200);
    expect(stream.body.streams).toEqual([]);
  });
});
