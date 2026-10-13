import { Injectable, type LoggerService } from "@nestjs/common";
import { AppConfig, type LogLevel } from "../config/app-config.js";
import { RequestContextService } from "../request-context/request-context.service.js";

const SEVERITY: Record<LogLevel, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };

export type LogFields = Record<string, unknown>;

export function serializeError(error: unknown): LogFields {
  if (!(error instanceof Error)) return { name: "NonError", message: String(error) };
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause === undefined ? {} : { cause: serializeError(error.cause) }),
  };
}

// Workers Logs indexes the fields of objects passed to console, so every entry is one plain object.
// https://developers.cloudflare.com/workers/observability/logs/workers-logs/
@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly threshold: number;

  public constructor(
    config: AppConfig,
    private readonly requestContext: RequestContextService,
  ) {
    this.threshold = SEVERITY[config.logLevel];
  }

  // The structured entry point; Nest's LoggerService methods below cannot carry fields.
  public write(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (SEVERITY[level] < this.threshold) return;
    const current = this.requestContext.current;
    const entry = {
      level,
      message,
      ...(current === undefined ? {} : { requestId: current.requestId, correlationId: current.correlationId }),
      ...fields,
    };
    if (SEVERITY[level] >= SEVERITY.error) console.error(entry);
    else if (level === "warn") console.warn(entry);
    else console.log(entry);
  }

  public log(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("info", message, optionalParams);
  }

  public error(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("error", message, optionalParams);
  }

  public warn(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("warn", message, optionalParams);
  }

  public debug(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("debug", message, optionalParams);
  }

  public verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("trace", message, optionalParams);
  }

  public fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.writeNest("fatal", message, optionalParams);
  }

  // Nest passes an optional context name as the last string parameter.
  private writeNest(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    const context = typeof optionalParams.at(-1) === "string" ? (optionalParams.at(-1) as string) : undefined;
    const fields: LogFields = context === undefined ? {} : { context };
    if (message instanceof Error) {
      this.write(level, message.message, { ...fields, error: serializeError(message) });
    } else if (typeof message === "string") {
      this.write(level, message, fields);
    } else {
      this.write(level, "Nest log", { ...fields, detail: message });
    }
  }
}
