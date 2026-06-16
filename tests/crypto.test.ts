import { describe, expect, it } from "vitest";
import { decryptConfig, encryptConfig } from "../src/crypto";
import { AddonConfig } from "../src/types";

const secret = "test-secret-test-secret-test-secret-test-secret";

function sampleConfig(): AddonConfig {
  return {
    v: 1,
    embyUrl: "https://emby.example.com",
    accessToken: "emby-token",
    userId: "user-1",
    movieLibraryIds: ["movies"],
    seriesLibraryIds: ["series"],
    createdAt: 123
  };
}

describe("encrypted addon config", () => {
  it("round-trips the config payload", () => {
    const encrypted = encryptConfig(sampleConfig(), secret);
    expect(decryptConfig(encrypted, secret)).toEqual(sampleConfig());
  });

  it("rejects tampered tokens", () => {
    const encrypted = encryptConfig(sampleConfig(), secret);
    const parts = encrypted.split(".");
    parts[2] = `${parts[2].startsWith("a") ? "b" : "a"}${parts[2].slice(1)}`;
    const tampered = parts.join(".");
    expect(() => decryptConfig(tampered, secret)).toThrow();
  });

  it("does not expose the Emby access token in plaintext", () => {
    const encrypted = encryptConfig(sampleConfig(), secret);
    expect(encrypted).not.toContain("emby-token");
  });
});
