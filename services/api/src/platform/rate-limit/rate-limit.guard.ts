import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { IncomingMessage as HttpRequest } from "node:http";
import { getVerifiedIdentity } from "../auth/request-auth.js";
import { ProblemException } from "../http/problem.exception.js";
import { StructuredLoggerService } from "../observability/structured-logger.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import { RATE_LIMIT_METADATA_KEY } from "./rate-limit.decorator.js";
import { RateLimitRuntimeService } from "./rate-limit-runtime.service.js";
import {
  FORWARDED_CLIENT_IP_HEADER,
  type RateLimitBinding,
  type RateLimitRule,
} from "./rate-limit.types.js";

function headerString(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function clientIp(request: HttpRequest, trustedWebClientIp: boolean): string {
  // Only honor x-zhipanda-client-ip over the V2_API service binding when Web props authorize it.
  if (trustedWebClientIp) {
    const forwarded = headerString(request.headers[FORWARDED_CLIENT_IP_HEADER]);
    if (forwarded !== undefined) return forwarded;
  }
  return (
    headerString(request.headers["cf-connecting-ip"]) ??
    headerString(request.socket?.remoteAddress) ??
    "unknown"
  );
}

function keysForRule(rule: RateLimitRule, ip: string, accountId: string | undefined): string[] {
  const strategy = rule.keyStrategy ?? "account_or_ip";
  if (strategy === "ip") return [`${rule.tier}:ip:${ip}`];
  if (strategy === "ip_and_account") {
    return accountId === undefined
      ? [`${rule.tier}:ip:${ip}`]
      : [`${rule.tier}:ip:${ip}`, `${rule.tier}:account:${accountId}`];
  }
  return accountId === undefined
    ? [`${rule.tier}:ip:${ip}`]
    : [`${rule.tier}:account:${accountId}`];
}

function bindingForTier(
  rule: RateLimitRule,
  runtime: RateLimitRuntimeService,
): RateLimitBinding | undefined {
  const bindings = runtime.current();
  if (bindings === undefined) return undefined;
  return rule.tier === "sensitive" ? bindings.SENSITIVE_RATE_LIMIT : bindings.WRITE_RATE_LIMIT;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly runtime: RateLimitRuntimeService,
    private readonly requestContext: RequestContextService,
    private readonly logger: StructuredLoggerService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(
      RATE_LIMIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (rule === undefined) return true;

    const binding = bindingForTier(rule, this.runtime);
    // Non-Worker test and local development environments run without Cloudflare rate-limit bindings.
    if (binding === undefined) return true;

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const accountId =
      getVerifiedIdentity(request)?.accountId ?? this.requestContext.current?.authentication?.actorId;
    const path = (request.url ?? "").split("?", 1)[0];
    const keys = keysForRule(
      rule,
      clientIp(request, this.runtime.isTrustedWebClientIp()),
      accountId,
    );

    for (const key of keys) {
      let outcome: { success: boolean };
      try {
        outcome = await binding.limit({ key });
      } catch (error) {
        this.logger.write("warn", "Rate-limit binding failed; allowing request", {
          tier: rule.tier,
          method: request.method,
          path,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        return true;
      }
      if (!outcome.success) {
        this.logger.write("warn", "Request rate-limited", {
          tier: rule.tier,
          method: request.method,
          path,
        });
        throw new ProblemException(
          429,
          "request.rateLimited",
          "Too many requests. Try again shortly.",
          { "Retry-After": String(rule.retryAfterSeconds ?? 60) },
        );
      }
    }

    return true;
  }
}
