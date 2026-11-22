import { Controller, Get, Post, type ExecutionContext } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import type { IncomingMessage } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureApplication } from "../src/bootstrap.js";
import { setVerifiedIdentity } from "../src/platform/auth/request-auth.js";
import { ConfigModule } from "../src/platform/config/config.module.js";
import { HttpPlatformModule } from "../src/platform/http/http-platform.module.js";
import { ProblemException } from "../src/platform/http/problem.exception.js";
import { ObservabilityModule } from "../src/platform/observability/observability.module.js";
import { RateLimit } from "../src/platform/rate-limit/rate-limit.decorator.js";
import { RateLimitGuard } from "../src/platform/rate-limit/rate-limit.guard.js";
import { RateLimitModule } from "../src/platform/rate-limit/rate-limit.module.js";
import { RateLimitRuntimeService } from "../src/platform/rate-limit/rate-limit-runtime.service.js";
import type { RateLimitWorkerBindings } from "../src/platform/rate-limit/rate-limit.types.js";
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
});
