import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage as HttpRequest } from "node:http";
import { AppConfig } from "../../../platform/config/app-config.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";

function bearerToken(request: HttpRequest): string | undefined {
  const raw = request.headers.authorization;
  if (typeof raw !== "string") return undefined;
  const match = /^Bearer ([^\s]+)$/i.exec(raw.trim());
  return match?.[1];
}

function constantTimeTokenMatch(provided: string, expected: string): boolean {
  const left = createHash("sha256").update(provided, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

/** Verifies `NEWS_INGEST_TOKEN` before DTO validation or direct controller invocation. */
export function assertNewsIngestAuthorized(request: HttpRequest, config: AppConfig): void {
  const expected = config.newsIngestToken;
  if (expected === undefined) {
    throw new ProblemException(503, "news.ingestDisabled", "News ingest is not configured on this server.");
  }
  const provided = bearerToken(request);
  if (provided === undefined || !constantTimeTokenMatch(provided, expected)) {
    throw new ProblemException(401, "news.invalidIngestToken", "A valid ingest bearer token is required.");
  }
}

@Injectable()
export class NewsIngestGuard implements CanActivate {
  public constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    assertNewsIngestAuthorized(request, this.config);
    return true;
  }
}
