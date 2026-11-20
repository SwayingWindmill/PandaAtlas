import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage as HttpRequest } from "node:http";
import { AppConfig } from "../platform/config/app-config.js";
import { ProblemException } from "../platform/http/problem.exception.js";

export const E2E_FIXTURE_TOKEN = Symbol("E2E_FIXTURE_TOKEN");
export const E2E_FIXTURE_HEADER = "x-e2e-fixture-token";

const ALLOWED_ENVIRONMENTS = new Set(["development", "test"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const MINIMUM_TOKEN_LENGTH = 16;

export function assertE2eFixtureEnvironment(
  environment: string | undefined,
  host: string | undefined,
  token: string | undefined,
): string {
  if (environment === undefined || !ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error("E2E fixture endpoints may only run when APP_ENV is development or test.");
  }
  const normalizedHost = host?.trim();
  if (normalizedHost === undefined || !LOOPBACK_HOSTS.has(normalizedHost)) {
    throw new Error("E2E fixture endpoints must bind to a loopback host (127.0.0.1, ::1, or localhost).");
  }
  const normalizedToken = token?.trim();
  if (normalizedToken === undefined || normalizedToken.length < MINIMUM_TOKEN_LENGTH) {
    throw new Error(`E2E_FIXTURE_TOKEN must be at least ${MINIMUM_TOKEN_LENGTH} characters.`);
  }
  return normalizedToken;
}

function tokensMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

@Injectable()
export class E2eFixtureGuard implements CanActivate {
  public constructor(
    private readonly config: AppConfig,
    @Inject(E2E_FIXTURE_TOKEN) private readonly expectedToken: string,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    if (!ALLOWED_ENVIRONMENTS.has(this.config.environment)) {
      throw new ProblemException(403, "e2e.fixtureForbidden", "E2E fixture access is forbidden.");
    }
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const rawHeader = request.headers[E2E_FIXTURE_HEADER];
    if (typeof rawHeader !== "string" || !tokensMatch(rawHeader, this.expectedToken)) {
      throw new ProblemException(403, "e2e.fixtureForbidden", "E2E fixture access is forbidden.");
    }
    return true;
  }
}
