import {
  ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { STATUS_CODES } from "node:http";
import { RequestContextService } from "../request-context/request-context.service.js";

interface ProblemDetails {
  type: "about:blank";
  title: string;
  status: number;
  detail: string;
  code: string;
  requestId: string;
  errors?: Array<{ message: string }>;
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
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<unknown>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const requestId = this.context.current?.requestId ?? "unavailable";
    const errors = validationErrors(exception);
    const problem: ProblemDetails = {
      type: "about:blank",
      title: STATUS_CODES[status] ?? "Request failed",
      status,
      detail: safeDetail(status, exception),
      code: errors === undefined ? codeForStatus(status) : "request.validationFailed",
      requestId,
      ...(errors === undefined ? {} : { errors }),
    };

    const { httpAdapter } = this.adapterHost;
    httpAdapter.setHeader(response, "Content-Type", "application/problem+json");
    httpAdapter.reply(response, problem, status);
  }
}
