import { Controller, Get, Injectable, Module, type ExecutionContext } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ExpressAdapter, type NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { FIXTURE_TOKEN, savedEnv } = vi.hoisted(() => {
  const token = "test-fixture-token-0123456789abcdef";
  const snapshot = {
    APP_ENV: process.env.APP_ENV,
    HOST: process.env.HOST,
    CORS_ALLOW_ORIGINS: process.env.CORS_ALLOW_ORIGINS,
    E2E_FIXTURE_TOKEN: process.env.E2E_FIXTURE_TOKEN,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
  };
  // ConfigModule validates process.env eagerly at module import time.
  process.env.APP_ENV = "test";
  process.env.HOST = "127.0.0.1";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.E2E_FIXTURE_TOKEN = token;
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_URL;
  return { FIXTURE_TOKEN: token, savedEnv: snapshot };
});

import { E2eFixtureAppModule, createE2eFixtureApplication } from "../src/e2e-fixture-server.js";
import { configureApplication, createApplication } from "../src/bootstrap.js";
import {
  E2E_FIXTURE_HEADER,
  E2eFixtureGuard,
  assertE2eFixtureEnvironment,
} from "../src/e2e-fixture/e2e-fixture.guard.js";
import { E2eFixtureModule } from "../src/e2e-fixture/e2e-fixture.module.js";
import { shanghaiMonthDay } from "../src/e2e-fixture/e2e-fixture.service.js";
import { RecentAuthCutoffStore } from "../src/e2e-fixture/recent-auth-cutoff.store.js";
import { RequireCapabilities } from "../src/modules/identity/http/access.metadata.js";
import type { AuthorizationSnapshot } from "../src/modules/identity/application/identity-access.types.js";
import { IDENTITY_PORT, type IdentityPort } from "../src/modules/identity/application/identity.port.js";
import { ApplicationAccessGuard } from "../src/modules/identity/http/application-access.guard.js";
import { IdentityModule } from "../src/modules/identity/identity.module.js";
import { AuthModule } from "../src/platform/auth/auth.module.js";
import { SupabaseAuthGuard } from "../src/platform/auth/supabase-auth.guard.js";
import { SupabaseJwtVerifier } from "../src/platform/auth/supabase-jwt.verifier.js";
import type { VerifiedSupabaseIdentity } from "../src/platform/auth/auth.types.js";
import type { AppConfig } from "../src/platform/config/app-config.js";
import { ConfigModule } from "../src/platform/config/config.module.js";
import { ProblemException } from "../src/platform/http/problem.exception.js";
import { HttpPlatformModule } from "../src/platform/http/http-platform.module.js";
import { injectHttp } from "./inject-http.js";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

let app: NestExpressApplication | undefined;

function restoreEnv(): void {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  process.env.APP_ENV = "test";
  process.env.HOST = "127.0.0.1";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.E2E_FIXTURE_TOKEN = FIXTURE_TOKEN;
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_URL;
});

afterEach(async () => {
  if (app !== undefined) {
    await app.close();
    app = undefined;
  }
  restoreEnv();
});

afterAll(() => {
  restoreEnv();
});

describe("E2E fixture environment & guard boundaries", () => {
  it("refuses non-dev/test environments, non-loopback hosts, and missing or short tokens", () => {
    expect(() => assertE2eFixtureEnvironment("production", "127.0.0.1", FIXTURE_TOKEN)).toThrow();
    expect(() => assertE2eFixtureEnvironment("staging", "127.0.0.1", FIXTURE_TOKEN)).toThrow();
    expect(() => assertE2eFixtureEnvironment("test", "0.0.0.0", FIXTURE_TOKEN)).toThrow();
    expect(() => assertE2eFixtureEnvironment("test", "127.0.0.1", undefined)).toThrow();
    expect(() => assertE2eFixtureEnvironment("test", "127.0.0.1", "too-short")).toThrow();

    expect(assertE2eFixtureEnvironment("development", "127.0.0.1", FIXTURE_TOKEN)).toBe(FIXTURE_TOKEN);
    expect(assertE2eFixtureEnvironment("test", "localhost", FIXTURE_TOKEN)).toBe(FIXTURE_TOKEN);
    expect(assertE2eFixtureEnvironment("test", "::1", FIXTURE_TOKEN)).toBe(FIXTURE_TOKEN);
  });

  it("rejects missing, mismatched, or differently sized fixture headers", () => {
    const config = { environment: "test" } as AppConfig;
    const guard = new E2eFixtureGuard(config, FIXTURE_TOKEN);
    const contextFor = (headers: Record<string, string>) =>
      ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as unknown as ExecutionContext;

    expect(() => guard.canActivate(contextFor({}))).toThrowError(ProblemException);
    expect(() =>
      guard.canActivate(contextFor({ [E2E_FIXTURE_HEADER]: "wrong-length" })),
    ).toThrowError(ProblemException);
    expect(() =>
      guard.canActivate(contextFor({ [E2E_FIXTURE_HEADER]: "x".repeat(FIXTURE_TOKEN.length) })),
    ).toThrowError(ProblemException);
    expect(guard.canActivate(contextFor({ [E2E_FIXTURE_HEADER]: FIXTURE_TOKEN }))).toBe(true);

    const prodGuard = new E2eFixtureGuard({ environment: "production" } as AppConfig, FIXTURE_TOKEN);
    expect(() =>
      prodGuard.canActivate(contextFor({ [E2E_FIXTURE_HEADER]: FIXTURE_TOKEN })),
    ).toThrowError(ProblemException);
  });

  it("keeps recent-auth cutoffs monotonic per account and isolated across accounts", () => {
    const store = new RecentAuthCutoffStore();
    expect(store.cutoffFor(ACCOUNT_ID)).toBeUndefined();
    expect(store.expire(ACCOUNT_ID, 1_000)).toBe(1_000_000);
    expect(store.expire(ACCOUNT_ID, 900)).toBe(1_000_000);
    expect(store.expire(ACCOUNT_ID, 1_050)).toBe(1_050_000);
    expect(store.cutoffFor(ACCOUNT_ID)).toBe(1_050_000);
    expect(store.cutoffFor("other-account")).toBeUndefined();
  });
});

@Controller("probe")
class RecentAuthProbeController {
  @RequireCapabilities("privacy.request.manage")
  @Get("sensitive")
  public sensitive(): { ok: true } {
    return { ok: true };
  }
}

@Injectable()
class FakeJwtVerifier {
  public verify(token: string): Promise<VerifiedSupabaseIdentity> {
    const authenticatedEpoch = Number(token);
    const now = Date.now();
    return Promise.resolve({
      accountId: ACCOUNT_ID,
      sessionId: SESSION_ID,
      aal: "aal1",
      issuedAt: new Date(now - 1_000),
      expiresAt: new Date(now + 300_000),
      authenticatedAt: new Date(authenticatedEpoch * 1_000),
      authenticationMethod: "otp",
    });
  }
}

@Module({
  imports: [ConfigModule, AuthModule, HttpPlatformModule, IdentityModule],
  controllers: [RecentAuthProbeController],
  providers: [
    { provide: APP_GUARD, useExisting: SupabaseAuthGuard },
    { provide: APP_GUARD, useExisting: ApplicationAccessGuard },
  ],
})
class ProbeBaseModule {}

describe("E2E fixture HTTP wiring", () => {
  it("does not mount E2E fixture endpoints on the production AppModule", async () => {
    app = await createApplication();

    const response = await injectHttp(app, {
      method: "POST",
      url: "/api/_test/e2e/seed",
      headers: { [E2E_FIXTURE_HEADER]: FIXTURE_TOKEN },
    });

    expect(response.statusCode).toBe(404);
  });

  it("refuses to create the E2E fixture application outside development/test", async () => {
    process.env.APP_ENV = "production";
    await expect(createE2eFixtureApplication()).rejects.toThrow();
  });

  it("boots the full E2eFixtureAppModule in test mode and guards /api/_test/e2e/* requests", async () => {
    app = await createE2eFixtureApplication();

    const forbidden = await injectHttp(app, {
      method: "POST",
      url: "/api/_test/e2e/auth/expire-recent",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ accountId: ACCOUNT_ID, afterEpochSeconds: 1_000 }),
    });
    expect(forbidden.statusCode).toBe(403);

    const allowed = await injectHttp(app, {
      method: "POST",
      url: "/api/_test/e2e/auth/expire-recent",
      headers: {
        "content-type": "application/json",
        [E2E_FIXTURE_HEADER]: FIXTURE_TOKEN,
      },
      payload: JSON.stringify({ accountId: ACCOUNT_ID, afterEpochSeconds: 1_000 }),
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({ accountId: ACCOUNT_ID, cutoffMs: 1_000_000 });
  });

  it("wires @Global E2eFixtureModule cutoff into ApplicationAccessGuard and rejects unauthenticated fixture calls", async () => {
    const t1 = Math.floor(Date.now() / 1_000) - 30;
    const t2 = t1 + 5;
    const snapshot: AuthorizationSnapshot = {
      accountId: ACCOUNT_ID,
      accountState: "active",
      capabilities: new Map([
        [
          "privacy.request.manage",
          {
            key: "privacy.request.manage",
            requiresRecentAuth: true,
            minimumAal: "aal1",
            requiresLiveSession: true,
          },
        ],
      ]),
    };
    const fakeIdentity: IdentityPort = {
      loadAuthorizationSnapshot: () => Promise.resolve(snapshot),
      isLiveSession: () => Promise.resolve(true),
      provisionAccount: () => Promise.reject(new Error("not used")),
      getProfile: () => Promise.reject(new Error("not used")),
      replaceProfile: () => Promise.reject(new Error("not used")),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ProbeBaseModule, E2eFixtureModule],
    })
      .overrideProvider(IDENTITY_PORT)
      .useValue(fakeIdentity)
      .overrideProvider(SupabaseJwtVerifier)
      .useClass(FakeJwtVerifier)
      .compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>(new ExpressAdapter());
    app = await configureApplication(nestApp);

    const before = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/probe/sensitive",
      headers: { authorization: `Bearer ${t1}` },
    });
    expect(before.statusCode).toBe(200);

    const forbidden = await injectHttp(app, {
      method: "POST",
      url: "/api/_test/e2e/auth/expire-recent",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ accountId: ACCOUNT_ID, afterEpochSeconds: t1 }),
    });
    expect(forbidden.statusCode).toBe(403);

    const expired = await injectHttp(app, {
      method: "POST",
      url: "/api/_test/e2e/auth/expire-recent",
      headers: {
        "content-type": "application/json",
        [E2E_FIXTURE_HEADER]: FIXTURE_TOKEN,
      },
      payload: JSON.stringify({ accountId: ACCOUNT_ID, afterEpochSeconds: t1 }),
    });
    expect(expired.statusCode).toBe(200);
    expect(expired.json()).toEqual({ accountId: ACCOUNT_ID, cutoffMs: t1 * 1_000 });

    const stale = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/probe/sensitive",
      headers: { authorization: `Bearer ${t1}` },
    });
    expect(stale.statusCode).toBe(403);
    expect(stale.json()).toMatchObject({ code: "auth.recentAuthRequired" });

    const fresh = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/probe/sensitive",
      headers: { authorization: `Bearer ${t2}` },
    });
    expect(fresh.statusCode).toBe(200);

    expect(E2eFixtureAppModule).toBeDefined();
  });

  it("formats seeded birthday month-day in Asia/Shanghai regardless of process timezone", () => {
    expect(shanghaiMonthDay(new Date("2026-11-22T15:59:59Z"))).toBe("11-22");
    expect(shanghaiMonthDay(new Date("2026-11-22T16:00:00Z"))).toBe("11-23");
    expect(shanghaiMonthDay(new Date("2026-11-22T17:30:00Z"))).toBe("11-23");
  });
});
