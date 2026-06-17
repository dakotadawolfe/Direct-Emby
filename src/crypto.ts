import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { AddonConfig } from "./types";

const TOKEN_PREFIX = "directemby_v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

interface Keys {
  encryptionKey: Buffer;
  signingKey: Buffer;
}

function deriveKeys(secret: string): Keys {
  const keyMaterial = scryptSync(secret, "directemby:addon-config:v1", 64);
  return {
    encryptionKey: keyMaterial.subarray(0, 32),
    signingKey: keyMaterial.subarray(32, 64)
  };
}

function sign(signingKey: Buffer, value: string): string {
  return createHmac("sha256", signingKey).update(value).digest("base64url");
}

function verifySignature(signingKey: Buffer, value: string, signature: string): void {
  const expected = Buffer.from(sign(signingKey, value), "base64url");
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid addon config signature");
  }
}

function assertConfigShape(value: unknown): asserts value is AddonConfig {
  const config = value as Partial<AddonConfig>;
  if (
    !config ||
    config.v !== 1 ||
    typeof config.embyUrl !== "string" ||
    typeof config.accessToken !== "string" ||
    typeof config.userId !== "string" ||
    !Array.isArray(config.movieLibraryIds) ||
    !Array.isArray(config.seriesLibraryIds) ||
    (config.preferSdr !== undefined && typeof config.preferSdr !== "boolean") ||
    typeof config.createdAt !== "number"
  ) {
    throw new Error("Invalid addon config payload");
  }
}

export function encryptConfig(config: AddonConfig, secret: string): string {
  const { encryptionKey, signingKey } = deriveKeys(secret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(config), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const unsigned = [
    TOKEN_PREFIX,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url")
  ].join(".");
  return `${unsigned}.${sign(signingKey, unsigned)}`;
}

export function decryptConfig(token: string, secret: string): AddonConfig {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== TOKEN_PREFIX) {
    throw new Error("Invalid addon config token");
  }

  const { encryptionKey, signingKey } = deriveKeys(secret);
  const unsigned = parts.slice(0, 4).join(".");
  verifySignature(signingKey, unsigned, parts[4]);

  const iv = Buffer.from(parts[1], "base64url");
  const ciphertext = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const decoded: unknown = JSON.parse(plaintext);
  assertConfigShape(decoded);
  return decoded;
}
