import {
  ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { STATUS_CODES, type IncomingMessage } from "node:http";
import { DomainError, type DomainErrorKind } from "../errors/domain-error.js";
import { serializeError, StructuredLoggerService } from "../observability/structured-logger.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import { ProblemException } from "./problem.exception.js";

interface ProblemDetails {
  type: "about:blank";
  title: string;
  status: number;
  detail: string;
  code: string;
  requestId: string;
  errors?: Array<{ message: string }>;
}

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  invalid: 400,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  unavailable: 503,
};

function statusOf(exception: unknown): number {
  if (exception instanceof DomainError) return STATUS_BY_KIND[exception.kind];
  return exception instanceof HttpException ? exception.getStatus() : 500;
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return "request.invalid";
    case 404:
      return "request.notFound";
    case 503:
      return "system.dependencyUnavailable";
    default:
      return status >= 500 ? "system.internal" : "request.failed";
  }
}

function safeDetail(status: number, exception: unknown): string {
  if (status >= 500) {
    return "The service could not complete the request.";
  }
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (typeof response === "string") {
      return response;
    }
    if (typeof response === "object" && response !== null && "message" in response) {
      const message = response.message;
      if (typeof message === "string") {
        return message;
      }
    }
  }
  return STATUS_CODES[status] ?? "Request failed";
}

function validationErrors(exception: unknown): Array<{ message: string }> | undefined {
  if (!(exception instanceof HttpException)) {
    return undefined;
  }
  const response = exception.getResponse();
  if (typeof response !== "object" || response === null || !("message" in response)) {
    return undefined;
  }
  const message = response.message;
  if (!Array.isArray(message)) {
    return undefined;
  }
  const errors = message.filter((item): item is string => typeof item === "string").slice(0, 20);
  return errors.length > 0 ? errors.map((item) => ({ message: item })) : undefined;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  public constructor(
    private readonly context: RequestContextService,
    private readonly adapterHost: HttpAdapterHost,
    private readonly logger: StructuredLoggerService,
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<unknown>();
    const status = statusOf(exception);
    if (status >= 500) {
      const request = http.getRequest<IncomingMessage>();
      this.logger.write("error", "Request failed", {
        method: request.method,
        path: (request.url ?? "").split("?", 1)[0],
        status,
        error: serializeError(exception),
      });
    }
    const requestId = this.context.current?.requestId ?? "unavailable";
    const errors = validationErrors(exception);
    const described = exception instanceof ProblemException || exception instanceof DomainError ? exception : undefined;
    const problem: ProblemDetails = {
      type: "about:blank",
      title: STATUS_CODES[status] ?? "Request failed",
      status,
      detail: described?.detail ?? safeDetail(status, exception),
      code:
        described !== undefined
          ? described.code
          : errors === undefined
            ? codeForStatus(status)
            : "request.validationFailed",
      requestId,
      ...(errors === undefined ? {} : { errors }),
    };

    const { httpAdapter } = this.adapterHost;
    httpAdapter.setHeader(response, "Content-Type", "application/problem+json");
    httpAdapter.reply(response, problem, status);
  }
}
