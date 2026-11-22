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
});
