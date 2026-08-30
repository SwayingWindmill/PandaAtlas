import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type AppEnvironment = "development" | "test" | "staging" | "production";
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface EnvironmentConfig {
  APP_ENV: AppEnvironment;
  HOST: string;
  PORT: number;
  CORS_ALLOW_ORIGINS: string[];
  DATABASE_URL: string | undefined;
  DATABASE_SSL_CA_CERT: string | undefined;
  DB_POOL_MAX: number;
  DB_CONNECTION_TIMEOUT_MS: number;
  DB_IDLE_TIMEOUT_MS: number;
  DB_MAX_LIFETIME_SECONDS: number;
  DB_STATEMENT_TIMEOUT_MS: number;
  DB_IDLE_TRANSACTION_TIMEOUT_MS: number;
  SUPABASE_URL: string | undefined;
  SUPABASE_JWT_AUDIENCE: string;
  AUTH_RECENT_WINDOW_SECONDS: number;
  AUTH_JWKS_TIMEOUT_MS: number;
  LOG_LEVEL: LogLevel;
  OTEL_SERVICE_NAME: string;
  SENTRY_DSN: string | undefined;
  RESEND_API_KEY: string | undefined;
  RESEND_FROM_EMAIL: string | undefined;
  CRON_SECRET: string | undefined;
}

const APP_ENVIRONMENTS = new Set<AppEnvironment>([
  "development",
  "test",
  "staging",
  "production",
]);
const LOG_LEVELS = new Set<LogLevel>(["trace", "debug", "info", "warn", "error", "fatal"]);

function parseInteger(
  value: unknown,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function parseSupabaseUrl(value: unknown): string | undefined {
  const raw = optionalString(value);
  return raw?.replace(/\/+$/, "");
}

export function validateEnvironment(
  input: Record<string, unknown>,
): EnvironmentConfig & Record<string, unknown> {
  const rawAppEnv = input.APP_ENV ?? "development";
  if (typeof rawAppEnv !== "string" || !APP_ENVIRONMENTS.has(rawAppEnv as AppEnvironment)) {
    throw new Error("APP_ENV must be development, test, staging, or production");
  }

  const appEnv = rawAppEnv as AppEnvironment;
  const databaseUrl = optionalString(input.DATABASE_URL);
  const supabaseUrl = parseSupabaseUrl(input.SUPABASE_URL);
  if ((appEnv === "production" || appEnv === "staging") && databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required in staging and production");
  }
  if ((appEnv === "production" || appEnv === "staging") && supabaseUrl === undefined) {
    throw new Error("SUPABASE_URL is required in staging and production");
  }

  const rawLogLevel = input.LOG_LEVEL ?? "info";
  if (typeof rawLogLevel !== "string" || !LOG_LEVELS.has(rawLogLevel as LogLevel)) {
    throw new Error("LOG_LEVEL must be trace, debug, info, warn, error, or fatal");
  }

  return {
    ...input,
    APP_ENV: appEnv,
    HOST: typeof input.HOST === "string" && input.HOST.trim() !== "" ? input.HOST : "0.0.0.0",
    PORT: parseInteger(input.PORT, 3001, "PORT", 1, 65_535),
    CORS_ALLOW_ORIGINS: parseOrigins(input.CORS_ALLOW_ORIGINS, appEnv),
    DATABASE_URL: databaseUrl,
    DATABASE_SSL_CA_CERT: optionalString(input.DATABASE_SSL_CA_CERT),
    DB_POOL_MAX: parseInteger(input.DB_POOL_MAX, 1, "DB_POOL_MAX", 1, 10),
    DB_CONNECTION_TIMEOUT_MS: parseInteger(
      input.DB_CONNECTION_TIMEOUT_MS,
      5_000,
      "DB_CONNECTION_TIMEOUT_MS",
      100,
      60_000,
    ),
    DB_IDLE_TIMEOUT_MS: parseInteger(
      input.DB_IDLE_TIMEOUT_MS,
      10_000,
      "DB_IDLE_TIMEOUT_MS",
      1_000,
      300_000,
    ),
    DB_MAX_LIFETIME_SECONDS: parseInteger(
      input.DB_MAX_LIFETIME_SECONDS,
      300,
      "DB_MAX_LIFETIME_SECONDS",
      30,
      3_600,
    ),
    DB_STATEMENT_TIMEOUT_MS: parseInteger(
      input.DB_STATEMENT_TIMEOUT_MS,
      10_000,
      "DB_STATEMENT_TIMEOUT_MS",
      100,
      120_000,
    ),
    DB_IDLE_TRANSACTION_TIMEOUT_MS: parseInteger(
      input.DB_IDLE_TRANSACTION_TIMEOUT_MS,
      5_000,
      "DB_IDLE_TRANSACTION_TIMEOUT_MS",
      100,
      120_000,
    ),
    SUPABASE_URL: supabaseUrl,
    SUPABASE_JWT_AUDIENCE:
      optionalString(input.SUPABASE_JWT_AUDIENCE) ?? "authenticated",
    AUTH_RECENT_WINDOW_SECONDS: parseInteger(
      input.AUTH_RECENT_WINDOW_SECONDS,
      900,
      "AUTH_RECENT_WINDOW_SECONDS",
      60,
      86_400,
    ),
    AUTH_JWKS_TIMEOUT_MS: parseInteger(
      input.AUTH_JWKS_TIMEOUT_MS,
      5_000,
      "AUTH_JWKS_TIMEOUT_MS",
      100,
      30_000,
    ),
    LOG_LEVEL: rawLogLevel as LogLevel,
    OTEL_SERVICE_NAME: optionalString(input.OTEL_SERVICE_NAME) ?? "zhipanda-api",
    SENTRY_DSN: optionalString(input.SENTRY_DSN),
    RESEND_API_KEY: optionalString(input.RESEND_API_KEY),
    RESEND_FROM_EMAIL: optionalString(input.RESEND_FROM_EMAIL),
    CRON_SECRET: optionalString(input.CRON_SECRET),
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

  public get databaseUrl(): string | undefined {
    return this.config.get("DATABASE_URL", { infer: true });
  }

  public get databaseSslCaCert(): string | undefined {
    return this.config.get("DATABASE_SSL_CA_CERT", { infer: true });
  }

  public get databasePoolMax(): number {
    return this.config.get("DB_POOL_MAX", { infer: true });
  }

  public get databaseConnectionTimeoutMs(): number {
    return this.config.get("DB_CONNECTION_TIMEOUT_MS", { infer: true });
  }

  public get databaseIdleTimeoutMs(): number {
    return this.config.get("DB_IDLE_TIMEOUT_MS", { infer: true });
  }

  public get databaseMaxLifetimeSeconds(): number {
    return this.config.get("DB_MAX_LIFETIME_SECONDS", { infer: true });
  }

  public get databaseStatementTimeoutMs(): number {
    return this.config.get("DB_STATEMENT_TIMEOUT_MS", { infer: true });
  }

  public get databaseIdleTransactionTimeoutMs(): number {
    return this.config.get("DB_IDLE_TRANSACTION_TIMEOUT_MS", { infer: true });
  }

  public get supabaseUrl(): string | undefined {
    return this.config.get("SUPABASE_URL", { infer: true });
  }

  public get supabaseJwtIssuer(): string | undefined {
    return this.supabaseUrl === undefined ? undefined : `${this.supabaseUrl}/auth/v1`;
  }

  public get supabaseJwksUrl(): URL | undefined {
    return this.supabaseUrl === undefined
      ? undefined
      : new URL(`${this.supabaseUrl}/auth/v1/.well-known/jwks.json`);
  }

  public get supabaseJwtAudience(): string {
    return this.config.get("SUPABASE_JWT_AUDIENCE", { infer: true });
  }

  public get recentAuthWindowSeconds(): number {
    return this.config.get("AUTH_RECENT_WINDOW_SECONDS", { infer: true });
  }

  public get authJwksTimeoutMs(): number {
    return this.config.get("AUTH_JWKS_TIMEOUT_MS", { infer: true });
  }

  public get logLevel(): LogLevel {
    return this.config.get("LOG_LEVEL", { infer: true });
  }

  public get otelServiceName(): string {
    return this.config.get("OTEL_SERVICE_NAME", { infer: true });
  }

  public get sentryDsn(): string | undefined {
    return this.config.get("SENTRY_DSN", { infer: true });
  }

  public get resendApiKey(): string | undefined {
    return this.config.get("RESEND_API_KEY", { infer: true });
  }

  public get resendFromEmail(): string | undefined {
    return this.config.get("RESEND_FROM_EMAIL", { infer: true });
  }

  public get cronSecret(): string | undefined {
    return this.config.get("CRON_SECRET", { infer: true });
  }
}
