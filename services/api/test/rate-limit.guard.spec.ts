import { Controller, Get, Post, type ExecutionContext } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import type { IncomingMessage } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import { configureApplication } from "../src/bootstrap.js";
import { IDENTITY_PORT, type IdentityPort } from "../src/modules/identity/application/identity.port.js";
import { setVerifiedIdentity } from "../src/platform/auth/request-auth.js";
import { SupabaseJwtVerifier } from "../src/platform/auth/supabase-jwt.verifier.js";
import { ConfigModule } from "../src/platform/config/config.module.js";
import { HttpPlatformModule } from "../src/platform/http/http-platform.module.js";
import { ProblemException } from "../src/platform/http/problem.exception.js";
import { ObservabilityModule } from "../src/platform/observability/observability.module.js";
import { RateLimit } from "../src/platform/rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "../src/platform/rate-limit/rate-limit.guard.js";
import { RateLimitModule } from "../src/platform/rate-limit/rate-limit.module.js";
import { RateLimitRuntimeService } from "../src/platform/rate-limit/rate-limit-runtime.service.js";
import {
  FORWARDED_CLIENT_IP_HEADER,
  type RateLimitRuntimeState,
  type RateLimitWorkerBindings,
} from "../src/platform/rate-limit/rate-limit.types.js";
import { RequestContextModule } from "../src/platform/request-context/request-context.module.js";
import { RequestContextService } from "../src/platform/request-context/request-context.service.js";
import { injectHttp } from "./inject-http.js";

function executionContext(request: IncomingMessage, handler: object): ExecutionContext {
  class FakeController {}
  return {
    getHandler: () => handler,
    getClass: () => FakeController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function methodHandler(proto: object, name: string): object {
  const descriptor = Object.getOwnPropertyDescriptor(proto, name);
  if (descriptor?.value === undefined) {
    throw new Error(`Missing method ${name}`);
  }
  return descriptor.value as object;
}

function makeRequest(
  headers: Record<string, string> = {},
  url = "/api/v2/me/favorites",
): IncomingMessage {
  return {
    method: "POST",
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as IncomingMessage;
}

function fakeIdentity(accountId: string) {
  const issuedAt = new Date();
  return {
    accountId,
    sessionId: "sess-1",
    aal: "aal1" as const,
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + 3_600_000),
    authenticatedAt: issuedAt,
    authenticationMethod: "otp",
  };
}

describe("RateLimitGuard", () => {
  it("allows unannotated routes even when bindings reject everything", async () => {
    const handler = () => "ok";
    const runtime = new RateLimitRuntimeService({
      WRITE_RATE_LIMIT: { limit: () => Promise.resolve({ success: false }) },
      SENSITIVE_RATE_LIMIT: { limit: () => Promise.resolve({ success: false }) },
    });
    const guard = new RateLimitGuard(
      new Reflector(),
      runtime,
      new RequestContextService(),
      { write: () => undefined } as never,
    );

    await expect(guard.canActivate(executionContext(makeRequest(), handler))).resolves.toBe(true);
  });

  it("allows annotated routes when no Worker rate-limit binding is configured", async () => {
    class Dummy {
      @RateLimit("write")
      public write() {
        return "ok";
      }
    }
    const runtime = new RateLimitRuntimeService();
    const guard = new RateLimitGuard(
      new Reflector(),
      runtime,
      new RequestContextService(),
      { write: () => undefined } as never,
    );

    await expect(
      guard.canActivate(executionContext(makeRequest(), methodHandler(Dummy.prototype, "write"))),
    ).resolves.toBe(true);
  });

  it("keys write rules by account when authenticated and falls back to IP when public", async () => {
    class Dummy {
      @RateLimit("write")
      public write() {
        return "ok";
      }
    }
    const keys: string[] = [];
    const runtime = new RateLimitRuntimeService({
      WRITE_RATE_LIMIT: {
        limit: ({ key }) => {
          keys.push(key);
          return Promise.resolve({ success: true });
        },
      },
    });
    const guard = new RateLimitGuard(
      new Reflector(),
      runtime,
      new RequestContextService(),
      { write: () => undefined } as never,
    );

    const handler = methodHandler(Dummy.prototype, "write");
    const authedReq = makeRequest({ "cf-connecting-ip": "198.51.100.10" });
    setVerifiedIdentity(authedReq, fakeIdentity("acc-1"));
    await expect(guard.canActivate(executionContext(authedReq, handler))).resolves.toBe(true);

    const publicReq = makeRequest({ "cf-connecting-ip": "203.0.113.7" });
    await expect(guard.canActivate(executionContext(publicReq, handler))).resolves.toBe(true);

    expect(keys).toEqual(["write:account:acc-1", "write:ip:203.0.113.7"]);
  });

  it("checks both ip and account for sensitive ip_and_account routes and rejects with 429 + Retry-After", async () => {
    class Dummy {
      @RateLimit("sensitive", { keyStrategy: "ip_and_account", retryAfterSeconds: 45 })
      public submit() {
        return "ok";
      }
    }
    const keys: string[] = [];
    const warnings: Array<{ message: string; fields: Record<string, unknown> }> = [];
    const runtime = new RateLimitRuntimeService({
      SENSITIVE_RATE_LIMIT: {
        limit: ({ key }) => {
          keys.push(key);
          return Promise.resolve({ success: !key.startsWith("sensitive:account:") });
        },
      },
    });
    const guard = new RateLimitGuard(
      new Reflector(),
      runtime,
      new RequestContextService(),
      {
        write: (_level: string, message: string, fields: Record<string, unknown>) =>
          warnings.push({ message, fields }),
      } as never,
    );

    const req = makeRequest({ "cf-connecting-ip": "198.51.100.99" }, "/api/v2/contributions?debug=1");
    setVerifiedIdentity(req, fakeIdentity("acc-secret"));

    const thrown = await guard
      .canActivate(executionContext(req, methodHandler(Dummy.prototype, "submit")))
      .catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(ProblemException);
    const problem = thrown as ProblemException;
    expect(problem.getStatus()).toBe(429);
    expect(problem.code).toBe("request.rateLimited");
    expect(problem.headers).toEqual({ "Retry-After": "45" });
    expect(keys).toEqual(["sensitive:ip:198.51.100.99", "sensitive:account:acc-secret"]);
    expect(warnings).toEqual([
      {
        message: "Request rate-limited",
        fields: { tier: "sensitive", method: "POST", path: "/api/v2/contributions" },
      },
    ]);
  });

  it("honors x-zhipanda-client-ip only when trustedWebClientIp is true", async () => {
    class Dummy {
      @RateLimit("write", { keyStrategy: "ip" })
      public guess() {
        return "ok";
      }
    }
    const keys: string[] = [];
    const runtime = new RateLimitRuntimeService({
      WRITE_RATE_LIMIT: {
        limit: ({ key }) => {
          keys.push(key);
          return Promise.resolve({ success: true });
        },
      },
    });
    const guard = new RateLimitGuard(
      new Reflector(),
      runtime,
      new RequestContextService(),
      { write: () => undefined } as never,
    );
    const handler = methodHandler(Dummy.prototype, "guess");

    // Untrusted external caller trying to spoof x-zhipanda-client-ip falls back to cf-connecting-ip.
    await expect(
      runtime.withBindings(
        {},
        () =>
          guard.canActivate(
            executionContext(
              makeRequest({
                "cf-connecting-ip": "198.51.100.1",
                [FORWARDED_CLIENT_IP_HEADER]: "203.0.113.250",
              }),
              handler,
            ),
          ),
        { trustedWebClientIp: false },
      ),
    ).resolves.toBe(true);

    // Trusted Web Service Binding caller forwards real browser IP via x-zhipanda-client-ip.
    await expect(
      runtime.withBindings(
        {},
        () =>
          guard.canActivate(
            executionContext(
              makeRequest({
                [FORWARDED_CLIENT_IP_HEADER]: "203.0.113.77",
              }),
              handler,
            ),
          ),
        { trustedWebClientIp: true },
      ),
    ).resolves.toBe(true);

    expect(keys).toEqual(["write:ip:198.51.100.1", "write:ip:203.0.113.77"]);
  });

  it("fails open and logs a warning when the binding throws", async () => {
    class Dummy {
      @RateLimit("write", { keyStrategy: "ip" })
      public guess() {
        return "ok";
      }
    }
    const warnings: Array<{ message: string; fields: Record<string, unknown> }> = [];
    const runtime = new RateLimitRuntimeService({
      WRITE_RATE_LIMIT: {
        limit: () => Promise.reject(new Error("worker binding timeout")),
      },
    });
    const guard = new RateLimitGuard(
      new Reflector(),
      runtime,
      new RequestContextService(),
      {
        write: (_level: string, message: string, fields: Record<string, unknown>) =>
          warnings.push({ message, fields }),
      } as never,
    );

    await expect(
      guard.canActivate(
        executionContext(
          makeRequest({ "cf-connecting-ip": "198.51.100.88" }, "/api/v2/games/guess/answer?foo=1"),
          methodHandler(Dummy.prototype, "guess"),
        ),
      ),
    ).resolves.toBe(true);
    expect(warnings).toEqual([
      {
        message: "Rate-limit binding failed; allowing request",
        fields: {
          tier: "write",
          method: "POST",
          path: "/api/v2/games/guess/answer",
          errorName: "Error",
        },
      },
    ]);
  });

  it("isolates bindings and trustedWebClientIp across concurrent async requests", async () => {
    const runtime = new RateLimitRuntimeService();
    const seen: Array<RateLimitRuntimeState | undefined> = [];

    await Promise.all([
      runtime.withBindings(
        { WRITE_RATE_LIMIT: { limit: () => Promise.resolve({ success: true }) } },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 15));
          seen.push(runtime.current());
        },
        { trustedWebClientIp: true },
      ),
      runtime.withBindings(
        { SENSITIVE_RATE_LIMIT: { limit: () => Promise.resolve({ success: false }) } },
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          seen.push(runtime.current());
        },
        { trustedWebClientIp: false },
      ),
    ]);

    expect(seen).toHaveLength(2);
    expect(seen[0]?.trustedWebClientIp).toBe(false);
    expect(seen[0]?.WRITE_RATE_LIMIT).toBeUndefined();
    expect(seen[0]?.SENSITIVE_RATE_LIMIT).toBeDefined();
    expect(seen[1]?.trustedWebClientIp).toBe(true);
    expect(seen[1]?.WRITE_RATE_LIMIT).toBeDefined();
    expect(seen[1]?.SENSITIVE_RATE_LIMIT).toBeUndefined();
  });
});

@Controller("test-rate-limit")
class TestRateLimitController {
  @Get("open")
  public open() {
    return { ok: true };
  }

  @Post("write")
  @RateLimit("write")
  public write() {
    return { ok: true };
  }
}

describe("RateLimitGuard HTTP integration", () => {
  let app: NestExpressApplication | undefined;

  beforeEach(() => {
    process.env.APP_ENV = "test";
    process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it("returns HTTP 429 Problem Details with Retry-After when a binding denies a request", async () => {
    let calls = 0;
    const override: RateLimitWorkerBindings = {
      WRITE_RATE_LIMIT: {
        limit: () => {
          calls += 1;
          return Promise.resolve({ success: calls <= 1 });
        },
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, ObservabilityModule, RequestContextModule, HttpPlatformModule, RateLimitModule],
      controllers: [TestRateLimitController],
      providers: [{ provide: APP_GUARD, useExisting: RateLimitGuard }],
    })
      .overrideProvider(RateLimitRuntimeService)
      .useValue(new RateLimitRuntimeService(override))
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>(new ExpressAdapter());
    await configureApplication(app);

    const first = await injectHttp(app, {
      method: "POST",
      url: "/api/v2/test-rate-limit/write",
      headers: { "cf-connecting-ip": "203.0.113.5" },
    });
    expect(first.statusCode).toBe(201);

    const second = await injectHttp(app, {
      method: "POST",
      url: "/api/v2/test-rate-limit/write",
      headers: { "cf-connecting-ip": "203.0.113.5" },
    });
    expect(second.statusCode).toBe(429);
    expect(second.headers["retry-after"]).toBe("60");
    expect(second.headers["content-type"]).toContain("application/problem+json");
    expect(second.json()).toMatchObject({
      status: 429,
      code: "request.rateLimited",
    });

    const open = await injectHttp(app, { method: "GET", url: "/api/v2/test-rate-limit/open" });
    expect(open.statusCode).toBe(200);
  });

  it("runs after SupabaseAuthGuard and uses verified account identity in AppModule guard chain", async () => {
    const keys: string[] = [];
    const runtime = new RateLimitRuntimeService({
      SENSITIVE_RATE_LIMIT: {
        limit: ({ key }) => {
          keys.push(key);
          return Promise.resolve({ success: true });
        },
      },
    });
    const accountId = "11111111-1111-4111-8111-111111111111";
    const identityPort: IdentityPort = {
      loadAuthorizationSnapshot: () => Promise.resolve(undefined),
      isLiveSession: () => Promise.resolve(true),
      provisionAccount: (id) =>
        Promise.resolve({
          accountId: id,
          accountState: "active",
          capabilities: new Map(),
        }),
      getProfile: () => Promise.reject(new Error("not used")),
      replaceProfile: () => Promise.reject(new Error("not used")),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RateLimitRuntimeService)
      .useValue(runtime)
      .overrideProvider(SupabaseJwtVerifier)
      .useValue({
        verify: () => Promise.resolve(fakeIdentity(accountId)),
      })
      .overrideProvider(IDENTITY_PORT)
      .useValue(identityPort)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>(new ExpressAdapter());
    await configureApplication(app);

    // Unauthenticated request fails 401 in SupabaseAuthGuard before reaching RateLimitGuard.
    const unauthenticated = await injectHttp(app, {
      method: "POST",
      url: "/api/v2/me/account",
      headers: { "cf-connecting-ip": "198.51.100.55" },
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(keys).toEqual([]);

    // @AllowUnprovisioned() authenticated request populates verified identity and keys both IP and accountId.
    const provisioned = await injectHttp(app, {
      method: "POST",
      url: "/api/v2/me/account",
      headers: {
        authorization: "Bearer valid-test-token",
        "cf-connecting-ip": "198.51.100.55",
      },
    });
    expect(provisioned.statusCode).toBe(201);
    expect(keys).toEqual([
      "sensitive:ip:198.51.100.55",
      `sensitive:account:${accountId}`,
    ]);
  });
});
