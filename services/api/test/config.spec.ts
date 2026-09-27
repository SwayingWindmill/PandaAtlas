import { describe, expect, it } from "vitest";
import { validateEnvironment } from "../src/platform/config/app-config.js";

describe("environment validation", () => {
  it("provides small local defaults for development", () => {
    const config = validateEnvironment({ APP_ENV: "development" });

    expect(config).toMatchObject({
      APP_ENV: "development",
      HOST: "0.0.0.0",
      PORT: 3001,
      CORS_ALLOW_ORIGINS: ["http://localhost:3000"],
    });
  });

  it("requires an explicit CORS allowlist in production", () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: "production",
        DATABASE_URL: "postgresql://example",
        SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow("CORS_ALLOW_ORIGINS is required in staging and production");
  });

  it("requires public cache revalidation wiring in production", () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: "production",
        CORS_ALLOW_ORIGINS: "https://zhipanda.com",
        DATABASE_URL: "postgresql://example",
        SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow("PUBLIC_WEB_BASE_URL and PUBLIC_REVALIDATION_AUTH are required in staging and production");
  });

  it("accepts a paired public Web origin and revalidation credential", () => {
    const config = validateEnvironment({
      APP_ENV: "production",
      CORS_ALLOW_ORIGINS: "https://zhipanda.com",
      DATABASE_URL: "postgresql://example",
      SUPABASE_URL: "https://example.supabase.co",
      PUBLIC_WEB_BASE_URL: "https://zhipanda.vercel.app",
      PUBLIC_REVALIDATION_AUTH: "x".repeat(32),
    });

    expect(config.PUBLIC_WEB_BASE_URL).toBe("https://zhipanda.vercel.app");
    expect(config.PUBLIC_REVALIDATION_AUTH).toHaveLength(32);
  });

  it("rejects an invalid port", () => {
    expect(() => validateEnvironment({ APP_ENV: "test", PORT: "70000" })).toThrow(
      "PORT must be an integer between 1 and 65535",
    );
  });
});
