import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/platform/config/app-config.js";
import { ProblemException } from "../src/platform/http/problem.exception.js";
import { RequestContextService } from "../src/platform/request-context/request-context.service.js";
import { setVerifiedIdentity } from "../src/platform/auth/request-auth.js";
import type { IdentityPort } from "../src/modules/identity/application/identity.port.js";
import {
  ALLOW_UNPROVISIONED,
  REQUIRED_AAL,
  REQUIRED_CAPABILITIES,
  REQUIRE_RECENT_AUTH,
} from "../src/modules/identity/http/access.metadata.js";
import { ApplicationAccessGuard } from "../src/modules/identity/http/application-access.guard.js";

const ACCOUNT_ID = "77777777-7777-4777-8777-777777777777";
const SESSION_ID = "88888888-8888-4888-8888-888888888888";

function createGuard(options: {
  authenticatedAt: Date | undefined;
  aal: "aal1" | "aal2";
  liveSession: boolean;
}): { guard: ApplicationAccessGuard; context: ExecutionContext } {
  const request = { headers: {} } as FastifyRequest;
  setVerifiedIdentity(request, {
    accountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    aal: options.aal,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    authenticatedAt: options.authenticatedAt,
    authenticationMethod: options.authenticatedAt === undefined ? undefined : "password",
  });

  const reflector = {
    getAllAndOverride: (key: symbol) => {
      if (key === REQUIRED_CAPABILITIES) return ["identity.role.manage"];
      if (key === REQUIRE_RECENT_AUTH || key === ALLOW_UNPROVISIONED) return false;
      if (key === REQUIRED_AAL) return undefined;
      return false;
    },
  } as unknown as Reflector;
  const identity: IdentityPort = {
    loadAuthorizationSnapshot() {
      return Promise.resolve({
        accountId: ACCOUNT_ID,
        accountState: "active",
        capabilities: new Map([
          [
            "identity.role.manage",
            {
              key: "identity.role.manage",
              requiresRecentAuth: true,
              minimumAal: "aal2",
              requiresLiveSession: true,
            },
          ],
        ]),
      });
    },
    isLiveSession() {
      return Promise.resolve(options.liveSession);
    },
    provisionAccount() {
      return Promise.reject(new Error("not used"));
    },
  };
  const config = { recentAuthWindowSeconds: 900 } as AppConfig;
  const guard = new ApplicationAccessGuard(
    reflector,
    identity,
    config,
    new RequestContextService(),
  );
  const context = {
    getHandler: () => createGuard,
    getClass: () => ApplicationAccessGuard,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe("ApplicationAccessGuard sensitive policy", () => {
  it.each([
    {
      name: "requires recent interactive auth",
      authenticatedAt: new Date(Date.now() - 901_000),
      aal: "aal2" as const,
      liveSession: true,
      code: "auth.recentAuthRequired",
    },
    {
      name: "requires AAL2",
      authenticatedAt: new Date(),
      aal: "aal1" as const,
      liveSession: true,
      code: "auth.aalRequired",
    },
    {
      name: "requires a live Supabase session",
      authenticatedAt: new Date(),
      aal: "aal2" as const,
      liveSession: false,
      code: "auth.liveSessionRequired",
    },
  ])("$name", async ({ authenticatedAt, aal, liveSession, code }) => {
    const { guard, context } = createGuard({ authenticatedAt, aal, liveSession });

    try {
      await guard.canActivate(context);
      throw new Error("guard unexpectedly allowed the request");
    } catch (error) {
      expect(error).toBeInstanceOf(ProblemException);
      expect((error as ProblemException).code).toBe(code);
    }
  });
});
