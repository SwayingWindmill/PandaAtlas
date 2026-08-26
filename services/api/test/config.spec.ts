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
    expect(() => validateEnvironment({ APP_ENV: "production" })).toThrow(
      "CORS_ALLOW_ORIGINS is required in staging and production",
    );
  });

  it("rejects an invalid port", () => {
    expect(() => validateEnvironment({ APP_ENV: "test", PORT: "70000" })).toThrow(
      "PORT must be an integer between 1 and 65535",
    );
  });
});
