import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/platform/config/app-config.js";
import type { PublicCacheInvalidationPort } from "../src/platform/http/public-cache-invalidation.port.js";
import { PublicCacheInvalidationService } from "../src/platform/http/public-cache-invalidation.service.js";

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    publicWebBaseUrl: undefined,
    publicRevalidationAuth: undefined,
    ...overrides,
  } as AppConfig;
}

function apiCache(): PublicCacheInvalidationPort & { purgePublicRead: ReturnType<typeof vi.fn> } {
  return {
    purgePublicRead: vi.fn().mockResolvedValue(undefined),
  };
}

describe("PublicCacheInvalidationService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.VERCEL;
  });

  it("posts to the Web revalidation endpoint after public state changes", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const cache = apiCache();
    const service = new PublicCacheInvalidationService(config({
      publicWebBaseUrl: "https://zhipanda.vercel.app",
      publicRevalidationAuth: "x".repeat(32),
    }), cache);

    await service.invalidatePublication();

    expect(cache.purgePublicRead).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://zhipanda.vercel.app/api/internal/publication/revalidate",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: `Bearer ${"x".repeat(32)}` },
      }),
    );
  });

  it("fails when the Web revalidation endpoint does not accept the invalidation", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const cache = apiCache();
    const service = new PublicCacheInvalidationService(config({
      publicWebBaseUrl: "https://zhipanda.vercel.app",
      publicRevalidationAuth: "x".repeat(32),
    }), cache);

    await expect(service.invalidatePublication()).rejects.toThrow(
      "Web publication cache revalidation failed with HTTP 503",
    );
  });

  it("is a local no-op when cross-project revalidation is not configured", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const cache = apiCache();
    const service = new PublicCacheInvalidationService(config(), cache);

    await service.invalidatePublication();

    expect(cache.purgePublicRead).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
