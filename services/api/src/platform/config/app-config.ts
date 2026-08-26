import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type AppEnvironment = "development" | "test" | "staging" | "production";

export interface EnvironmentConfig {
  APP_ENV: AppEnvironment;
  HOST: string;
  PORT: number;
  CORS_ALLOW_ORIGINS: string[];
}

const APP_ENVIRONMENTS = new Set<AppEnvironment>([
  "development",
  "test",
  "staging",
  "production",
]);

function parsePort(value: unknown): number {
  const port = value === undefined || value === "" ? 3001 : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

function parseOrigins(value: unknown, appEnv: AppEnvironment): string[] {
  if (typeof value !== "string" || value.trim() === "") {
    if (appEnv === "production" || appEnv === "staging") {
      throw new Error("CORS_ALLOW_ORIGINS is required in staging and production");
    }
    return ["http://localhost:3000"];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function validateEnvironment(
  input: Record<string, unknown>,
): EnvironmentConfig & Record<string, unknown> {
  const rawAppEnv = input.APP_ENV ?? "development";
  if (typeof rawAppEnv !== "string" || !APP_ENVIRONMENTS.has(rawAppEnv as AppEnvironment)) {
    throw new Error("APP_ENV must be development, test, staging, or production");
  }

  const appEnv = rawAppEnv as AppEnvironment;
  return {
    ...input,
    APP_ENV: appEnv,
    HOST: typeof input.HOST === "string" && input.HOST.trim() !== "" ? input.HOST : "0.0.0.0",
    PORT: parsePort(input.PORT),
    CORS_ALLOW_ORIGINS: parseOrigins(input.CORS_ALLOW_ORIGINS, appEnv),
  };
}

@Injectable()
export class AppConfig {
  public constructor(private readonly config: ConfigService<EnvironmentConfig, true>) {}

  public get environment(): AppEnvironment {
    return this.config.get("APP_ENV", { infer: true });
  }

  public get host(): string {
    return this.config.get("HOST", { infer: true });
  }

  public get port(): number {
    return this.config.get("PORT", { infer: true });
  }

  public get corsAllowOrigins(): string[] {
    return this.config.get("CORS_ALLOW_ORIGINS", { infer: true });
  }
}
