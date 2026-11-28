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

  it("validates OPS_ALERT_WEBHOOK_URL and OPS_ALERT_WEBHOOK_FORMAT", () => {
    expect(validateEnvironment({ APP_ENV: "test" })).toMatchObject({
      OPS_ALERT_WEBHOOK_URL: undefined,
      OPS_ALERT_WEBHOOK_FORMAT: "feishu",
    });
    expect(
      validateEnvironment({
        APP_ENV: "production",
        CORS_ALLOW_ORIGINS: "https://www.zhipanda.com",
        DATABASE_URL: "postgresql://example",
        SUPABASE_URL: "https://example.supabase.co",
        OPS_ALERT_WEBHOOK_URL: "https://open.feishu.cn/open-apis/bot/v2/hook/abc",
        OPS_ALERT_WEBHOOK_FORMAT: "wecom",
      }),
    ).toMatchObject({
      OPS_ALERT_WEBHOOK_URL: "https://open.feishu.cn/open-apis/bot/v2/hook/abc",
      OPS_ALERT_WEBHOOK_FORMAT: "wecom",
    });
    expect(
      validateEnvironment({
        APP_ENV: "test",
        OPS_ALERT_WEBHOOK_URL: "http://127.0.0.1:8787/hook",
      }).OPS_ALERT_WEBHOOK_URL,
    ).toBe("http://127.0.0.1:8787/hook");
    expect(() =>
      validateEnvironment({
        APP_ENV: "production",
        CORS_ALLOW_ORIGINS: "https://www.zhipanda.com",
        DATABASE_URL: "postgresql://example",
        SUPABASE_URL: "https://example.supabase.co",
        OPS_ALERT_WEBHOOK_URL: "http://127.0.0.1:8787/hook",
      }),
    ).toThrow("OPS_ALERT_WEBHOOK_URL must use https");
    expect(() =>
      validateEnvironment({
        APP_ENV: "test",
        OPS_ALERT_WEBHOOK_FORMAT: "slack",
      }),
    ).toThrow("OPS_ALERT_WEBHOOK_FORMAT must be feishu, wecom, or generic");
  });

  it("validates EXPO_ACCESS_TOKEN and EXPO_PUSH_ENDPOINT", () => {
    expect(validateEnvironment({ APP_ENV: "test" })).toMatchObject({
      EXPO_ACCESS_TOKEN: undefined,
      EXPO_PUSH_ENDPOINT: "https://exp.host/--/api/v2/push/send",
    });
    expect(
      validateEnvironment({
        APP_ENV: "test",
        EXPO_ACCESS_TOKEN: "expo-token-123",
        EXPO_PUSH_ENDPOINT: "http://127.0.0.1:8788/push",
      }),
    ).toMatchObject({
      EXPO_ACCESS_TOKEN: "expo-token-123",
      EXPO_PUSH_ENDPOINT: "http://127.0.0.1:8788/push",
    });
    expect(() =>
      validateEnvironment({
        APP_ENV: "production",
        CORS_ALLOW_ORIGINS: "https://www.zhipanda.com",
        DATABASE_URL: "postgresql://example",
        SUPABASE_URL: "https://example.supabase.co",
        EXPO_PUSH_ENDPOINT: "http://127.0.0.1:8788/push",
      }),
    ).toThrow("EXPO_PUSH_ENDPOINT must use https");
    expect(() =>
      validateEnvironment({
        APP_ENV: "test",
        EXPO_PUSH_ENDPOINT: "not-a-url",
      }),
    ).toThrow("EXPO_PUSH_ENDPOINT must be a valid URL");
  });

  it("validates optional Apple revocation credentials cleanly", () => {
    const validKey = Buffer.alloc(32, 7).toString("base64");
    expect(validateEnvironment({ APP_ENV: "test" })).toMatchObject({
      APPLE_CLIENT_ID: "com.zhipanda.app",
      APPLE_TEAM_ID: undefined,
      APPLE_TOKEN_ENDPOINT: "https://appleid.apple.com/auth/token",
      APPLE_REVOKE_ENDPOINT: "https://appleid.apple.com/auth/revoke",
    });

    expect(() =>
      validateEnvironment({
        APP_ENV: "test",
        APPLE_TEAM_ID: "TEAM123456",
      }),
    ).toThrow("APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, and APPLE_TOKEN_ENCRYPTION_KEY must all be set together");

    expect(() =>
      validateEnvironment({
        APP_ENV: "test",
        APPLE_TEAM_ID: "TEAM123456",
        APPLE_KEY_ID: "KEY123456",
        APPLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
        APPLE_TOKEN_ENCRYPTION_KEY: "too-short",
      }),
    ).toThrow("APPLE_TOKEN_ENCRYPTION_KEY must be base64 for a 32-byte key");

    const configured = validateEnvironment({
      APP_ENV: "test",
      APPLE_TEAM_ID: "TEAM123456",
      APPLE_KEY_ID: "KEY123456",
      APPLE_PRIVATE_KEY: "line1\\nline2",
      APPLE_TOKEN_ENCRYPTION_KEY: validKey,
      APPLE_TOKEN_ENDPOINT: "http://127.0.0.1:8789/token",
    });
    expect(configured.APPLE_PRIVATE_KEY).toBe("line1\nline2");
    expect(configured.APPLE_TOKEN_ENDPOINT).toBe("http://127.0.0.1:8789/token");
  });

  it("validates NEWS_INGEST_TOKEN and NEWS_AUTO_PUBLISH_TIERS", () => {
    expect(validateEnvironment({ APP_ENV: "test" })).toMatchObject({
      NEWS_INGEST_TOKEN: undefined,
      NEWS_AUTO_PUBLISH_TIERS: ["institution", "official"],
    });
    expect(
      validateEnvironment({
        APP_ENV: "test",
        NEWS_INGEST_TOKEN: "news-ingest-secret-token",
        NEWS_AUTO_PUBLISH_TIERS: "",
      }),
    ).toMatchObject({
      NEWS_INGEST_TOKEN: "news-ingest-secret-token",
      NEWS_AUTO_PUBLISH_TIERS: [],
    });
    expect(() =>
      validateEnvironment({ APP_ENV: "test", NEWS_INGEST_TOKEN: "short" }),
    ).toThrow("NEWS_INGEST_TOKEN must be at least 16 characters");
    expect(() =>
      validateEnvironment({ APP_ENV: "test", NEWS_AUTO_PUBLISH_TIERS: "institution,unknown" }),
    ).toThrow("NEWS_AUTO_PUBLISH_TIERS entries must be");
  });
});
