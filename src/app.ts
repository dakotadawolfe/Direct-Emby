import express, { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { TtlCache } from "./cache";
import { configurePage } from "./configurePage";
import { decryptConfig, encryptConfig } from "./crypto";
import { EmbyApiError, EmbyClient, toPublicEmbyUrl } from "./emby";
import {
  AddonConfig,
  FetchLike,
  RuntimeConfig,
  SetupSession,
  StremioContentType
} from "./types";
import { buildCatalogResponse, buildManifest, buildMetaResponse, buildStreamResponse, parseCatalogExtra } from "./stremio";

interface CreateAppOptions {
  config: RuntimeConfig;
  fetchImpl?: FetchLike;
}

interface AsyncRequestHandler {
  (req: Request, res: Response, next: NextFunction): Promise<void>;
}

function asyncHandler(handler: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

function jsonError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({
    error: {
      code,
      message
    }
  });
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function requireAddonConfig(req: Request, secret: string): AddonConfig {
  const raw = req.params.config;
  if (!raw) {
    throw new Error("Missing addon config");
  }

  return decryptConfig(raw, secret);
}

function publicBaseUrl(req: Request, configured?: string): string {
  const base = configured?.trim() || `${req.protocol}://${req.get("host")}`;
  return base.replace(/\/+$/, "");
}

function installUrlFor(baseUrl: string, encryptedConfig: string): { installUrl: string; manifestUrl: string } {
  const manifestUrl = `${baseUrl}/${encryptedConfig}/manifest.json`;
  const stremioTarget = manifestUrl.replace(/^https?:\/\//i, "");
  return {
    installUrl: `stremio://${stremioTarget}`,
    manifestUrl
  };
}

function assertContentType(value: string): asserts value is StremioContentType {
  if (value !== "movie" && value !== "series") {
    throw new Error("Unsupported Stremio type");
  }
}

export function createApp(options: CreateAppOptions) {
  const app = express();
  const emby = new EmbyClient({
    fetchImpl: options.fetchImpl,
    cacheTtlMs: options.config.cacheTtlMs
  });
  const setupSessions = new TtlCache<SetupSession>(options.config.setupSessionTtlMs);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "32kb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept,Origin");
    res.setHeader("Access-Control-Max-Age", "86400");
    next();
  });
  app.options("*", (_req, res) => {
    res.sendStatus(204);
  });

  app.get("/", (_req, res) => {
    res.redirect(302, "/configure");
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      name: "DirectEmby",
      version: "1.0.0"
    });
  });

  app.get("/configure", (_req, res) => {
    res.type("html").send(configurePage());
  });

  app.get("/:config/configure", (_req, res) => {
    res.redirect(302, "/configure");
  });

  app.post(
    "/configure/libraries",
    asyncHandler(async (req, res) => {
      const { embyUrl, username, password } = req.body as Record<string, unknown>;
      if (typeof embyUrl !== "string" || typeof username !== "string" || typeof password !== "string") {
        jsonError(res, 400, "bad_request", "Emby URL, username, and password are required.");
        return;
      }

      const normalizedUrl = toPublicEmbyUrl(embyUrl);
      const auth = await emby.authenticate(normalizedUrl, username, password);
      const session: SetupSession = {
        embyUrl: normalizedUrl,
        accessToken: auth.accessToken,
        userId: auth.userId,
        createdAt: Date.now()
      };
      const setupId = randomUUID();
      setupSessions.set(setupId, session);
      const libraries = await emby.getLibraries(session);

      res.json({
        setupId,
        movieLibraries: libraries.filter((library) => library.collectionType === "movies"),
        seriesLibraries: libraries.filter((library) => library.collectionType === "tvshows")
      });
    })
  );

  app.post(
    "/configure/link",
    asyncHandler(async (req, res) => {
      const setupId = typeof req.body?.setupId === "string" ? req.body.setupId : "";
      const session = setupSessions.take(setupId);
      if (!session) {
        jsonError(res, 400, "setup_expired", "Setup session expired. Connect again.");
        return;
      }

      const movieLibraryIds = asStringArray(req.body.movieLibraryIds);
      const seriesLibraryIds = asStringArray(req.body.seriesLibraryIds);
      if (movieLibraryIds.length === 0 && seriesLibraryIds.length === 0) {
        jsonError(res, 400, "bad_request", "Select at least one library.");
        return;
      }

      const addonConfig: AddonConfig = {
        v: 1,
        embyUrl: session.embyUrl,
        accessToken: session.accessToken,
        userId: session.userId,
        movieLibraryIds,
        seriesLibraryIds,
        preferSdr: req.body.preferSdr === true,
        createdAt: Date.now()
      };
      const encrypted = encryptConfig(addonConfig, options.config.encryptionSecret);
      res.json(installUrlFor(publicBaseUrl(req, options.config.publicBaseUrl), encrypted));
    })
  );

  app.get(
    "/:config/manifest.json",
    asyncHandler(async (req, res) => {
      requireAddonConfig(req, options.config.encryptionSecret);
      res.json(buildManifest());
    })
  );

  app.get(
    "/:config/catalog/:type/:catalogId.json",
    asyncHandler(async (req, res) => {
      const addonConfig = requireAddonConfig(req, options.config.encryptionSecret);
      assertContentType(req.params.type);
      const extra = parseCatalogExtra(undefined, req.query);
      res.json(await buildCatalogResponse(emby, addonConfig, req.params.type, req.params.catalogId, extra));
    })
  );

  app.get(
    "/:config/catalog/:type/:catalogId/:extra.json",
    asyncHandler(async (req, res) => {
      const addonConfig = requireAddonConfig(req, options.config.encryptionSecret);
      assertContentType(req.params.type);
      const extra = parseCatalogExtra(req.params.extra, req.query);
      res.json(await buildCatalogResponse(emby, addonConfig, req.params.type, req.params.catalogId, extra));
    })
  );

  app.get(
    "/:config/meta/:type/:id.json",
    asyncHandler(async (req, res) => {
      const addonConfig = requireAddonConfig(req, options.config.encryptionSecret);
      assertContentType(req.params.type);
      res.json(await buildMetaResponse(emby, addonConfig, req.params.type, req.params.id));
    })
  );

  app.get(
    "/:config/stream/:type/:id.json",
    asyncHandler(async (req, res) => {
      const addonConfig = requireAddonConfig(req, options.config.encryptionSecret);
      assertContentType(req.params.type);
      res.json(await buildStreamResponse(emby, addonConfig, req.params.type, req.params.id));
    })
  );

  app.use((req, res) => {
    jsonError(res, 404, "not_found", `No route for ${req.method} ${req.path}`);
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
      return;
    }

    if (error instanceof EmbyApiError) {
      jsonError(res, error.status && error.status >= 400 ? error.status : 502, "emby_error", error.message);
      return;
    }

    const message = error instanceof Error ? error.message : "Request failed";
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("config") || lowerMessage.includes("unsupported stremio type")) {
      jsonError(res, 400, "bad_request", message);
      return;
    }

    jsonError(res, 500, "internal_error", "Request failed.");
  });

  return app;
}
