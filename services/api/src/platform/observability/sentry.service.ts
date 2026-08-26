import { Injectable, type OnModuleInit } from "@nestjs/common";
import { AppConfig } from "../config/app-config.js";

@Injectable()
export class SentryService implements OnModuleInit {
  private readonly dsn: string | undefined;
  private capture: ((error: unknown) => unknown) | undefined;

  public constructor(config: AppConfig) {
    this.dsn = config.sentryDsn;
  }

  public async onModuleInit(): Promise<void> {
    if (this.dsn === undefined) {
      return;
    }
    const sentry = await import("@sentry/nestjs");
    sentry.init({
      dsn: this.dsn,
      skipOpenTelemetrySetup: true,
    });
    this.capture = sentry.captureException;
  }

  public captureException(error: unknown): void {
    this.capture?.(error);
  }
}
