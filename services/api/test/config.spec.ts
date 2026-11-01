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

  it("rejects an invalid port", () => {
    expect(() => validateEnvironment({ APP_ENV: "test", PORT: "70000" })).toThrow(
      "PORT must be an integer between 1 and 65535",
    );
  });

  it("keeps 问问熊猫 off with a small daily cap unless configured", () => {
    expect(validateEnvironment({ APP_ENV: "test" })).toMatchObject({ ASK_ENABLED: false, ASK_GLOBAL_DAILY_CAP: 30 });
    expect(validateEnvironment({ APP_ENV: "test", ASK_ENABLED: "true", ASK_GLOBAL_DAILY_CAP: "5" })).toMatchObject({
      ASK_ENABLED: true,
      ASK_GLOBAL_DAILY_CAP: 5,
    });
  });

  it("rejects an unclear ask switch", () => {
    expect(() => validateEnvironment({ APP_ENV: "test", ASK_ENABLED: "yes" })).toThrow("ASK_ENABLED must be true or false");
  });
});
