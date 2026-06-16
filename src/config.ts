import { RuntimeConfig } from "./types";

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }

  return value;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const encryptionSecret = process.env.ENCRYPTION_SECRET;
  if (!encryptionSecret || encryptionSecret.length < 32) {
    throw new Error("ENCRYPTION_SECRET must be set to at least 32 characters");
  }

  return {
    port: readNumber("PORT", 3000),
    encryptionSecret,
    publicBaseUrl: process.env.PUBLIC_BASE_URL,
    cacheTtlMs: readNumber("CACHE_TTL_SECONDS", 300) * 1000,
    setupSessionTtlMs: readNumber("SETUP_SESSION_TTL_SECONDS", 600) * 1000
  };
}
