import { Injectable, type LoggerService } from "@nestjs/common";
import pino, { type Logger } from "pino";
import { AppConfig } from "../config/app-config.js";
import { RequestContextService } from "../request-context/request-context.service.js";

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  public constructor(
    config: AppConfig,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = pino({
      level: config.logLevel,
      base: { service: config.otelServiceName },
    });
  }

  public log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("info", message, optionalParams);
  }

  public error(message: unknown, ...optionalParams: unknown[]): void {
    this.write("error", message, optionalParams);
  }

  public warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write("warn", message, optionalParams);
  }

  public debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", message, optionalParams);
  }

  public verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write("trace", message, optionalParams);
  }

  public fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write("fatal", message, optionalParams);
  }

  private write(
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal",
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const current = this.requestContext.current;
    const context =
      optionalParams.length > 0 && typeof optionalParams.at(-1) === "string"
        ? optionalParams.at(-1)
        : undefined;
    const fields = {
      ...(current === undefined
        ? {}
        : { requestId: current.requestId, correlationId: current.correlationId }),
      ...(context === undefined ? {} : { context }),
    };

    if (message instanceof Error) {
      this.logger[level]({ ...fields, err: message }, message.message);
      return;
    }
    if (typeof message === "string") {
      this.logger[level](fields, message);
      return;
    }
    this.logger[level]({ ...fields, message }, "Nest log");
  }
}
