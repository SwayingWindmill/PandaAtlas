import { Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { RequestContextService } from "./request-context.service.js";

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function readCorrelationId(request: IncomingMessage, fallback: string): string {
  const value = request.headers["x-correlation-id"];
  if (typeof value === "string" && CORRELATION_ID_PATTERN.test(value)) {
    return value;
  }
  return fallback;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  public constructor(private readonly context: RequestContextService) {}

  public use(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    const requestId = randomUUID();
    response.setHeader("X-Request-Id", requestId);

    this.context.run(
      {
        requestId,
        correlationId: readCorrelationId(request, requestId),
        startedAt: Date.now(),
      },
      next,
    );
  }
}
