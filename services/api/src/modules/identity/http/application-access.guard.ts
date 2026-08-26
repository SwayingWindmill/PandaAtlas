import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { AppConfig } from "../../../platform/config/app-config.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { IS_PUBLIC } from "../../../platform/auth/public.decorator.js";
import { getVerifiedIdentity } from "../../../platform/auth/request-auth.js";
import type { AssuranceLevel, CapabilityPolicy } from "../application/identity-access.types.js";
import { IDENTITY_PORT, type IdentityPort } from "../application/identity.port.js";
import {
  ALLOW_SUSPENDED_ACCOUNT,
  ALLOW_UNPROVISIONED,
  REQUIRED_AAL,
  REQUIRED_CAPABILITIES,
  REQUIRE_RECENT_AUTH,
} from "./access.metadata.js";
import { setActorContext } from "./request-actor.js";

function strongerAal(left: AssuranceLevel, right: AssuranceLevel): AssuranceLevel {
  return left === "aal2" || right === "aal2" ? "aal2" : "aal1";
}

function capabilityPolicy(
  requiredCapabilities: readonly string[],
  snapshot: ReadonlyMap<string, CapabilityPolicy>,
): CapabilityPolicy[] {
  return requiredCapabilities.map((key) => {
    const policy = snapshot.get(key);
    if (policy === undefined) {
      throw new ProblemException(
        403,
        "authorization.capabilityRequired",
        "The authenticated account is not allowed to perform this operation.",
      );
    }
    return policy;
  });
}

@Injectable()
export class ApplicationAccessGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly config: AppConfig,
    private readonly requestContext: RequestContextService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const verifiedIdentity = getVerifiedIdentity(request);
    if (verifiedIdentity === undefined) {
      throw new ProblemException(401, "auth.invalidToken", "A valid bearer token is required.");
    }

    let snapshot;
    try {
      snapshot = await this.identity.loadAuthorizationSnapshot(verifiedIdentity.accountId);
    } catch {
      throw new ProblemException(
        503,
        "system.dependencyUnavailable",
        "Authorization state is unavailable.",
      );
    }

    const allowUnprovisioned =
      this.reflector.getAllAndOverride<boolean>(ALLOW_UNPROVISIONED, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    if (snapshot === undefined) {
      if (allowUnprovisioned) {
        return true;
      }
      throw new ProblemException(
        403,
        "authorization.accountRequired",
        "An application account is required for this operation.",
      );
    }
    const allowSuspendedAccount =
      this.reflector.getAllAndOverride<boolean>(ALLOW_SUSPENDED_ACCOUNT, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    if (
      snapshot.accountState !== "active" &&
      !(allowSuspendedAccount && snapshot.accountState === "suspended")
    ) {
      throw new ProblemException(
        403,
        "authorization.accountInactive",
        "The application account is not active.",
      );
    }

    const requiredCapabilities =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_CAPABILITIES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const policies = capabilityPolicy(requiredCapabilities, snapshot.capabilities);

    const routeRecentAuth =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_RECENT_AUTH, [
        context.getHandler(),
        context.getClass(),
      ]) === true;
    const routeAal =
      this.reflector.getAllAndOverride<AssuranceLevel>(REQUIRED_AAL, [
        context.getHandler(),
        context.getClass(),
      ]) ?? "aal1";

    const requiresRecentAuth = routeRecentAuth || policies.some((policy) => policy.requiresRecentAuth);
    const requiredAal = policies.reduce(
      (minimum, policy) => strongerAal(minimum, policy.minimumAal),
      routeAal,
    );
    const requiresLiveSession = policies.some((policy) => policy.requiresLiveSession);

    if (requiresRecentAuth) {
      const authenticatedAt = verifiedIdentity.authenticatedAt;
      const recentWindowMs = this.config.recentAuthWindowSeconds * 1_000;
      if (
        authenticatedAt === undefined ||
        Date.now() - authenticatedAt.getTime() < 0 ||
        Date.now() - authenticatedAt.getTime() > recentWindowMs
      ) {
        throw new ProblemException(
          403,
          "auth.recentAuthRequired",
          "Recent interactive authentication is required.",
        );
      }
    }

    if (requiredAal === "aal2" && verifiedIdentity.aal !== "aal2") {
      throw new ProblemException(403, "auth.aalRequired", "AAL2 authentication is required.");
    }

    if (requiresLiveSession) {
      let live = false;
      try {
        live = await this.identity.isLiveSession(
          verifiedIdentity.sessionId,
          verifiedIdentity.accountId,
        );
      } catch {
        throw new ProblemException(
          503,
          "system.dependencyUnavailable",
          "Session verification is unavailable.",
        );
      }
      if (!live) {
        throw new ProblemException(
          403,
          "auth.liveSessionRequired",
          "The current authentication session is no longer active.",
        );
      }
    }

    const capabilities = new Set(snapshot.capabilities.keys());
    setActorContext(request, {
      accountId: snapshot.accountId,
      sessionId: verifiedIdentity.sessionId,
      aal: verifiedIdentity.aal,
      authenticatedAt: verifiedIdentity.authenticatedAt,
      authenticationMethod: verifiedIdentity.authenticationMethod,
      capabilities,
    });
    this.requestContext.setAuthorization({
      accountState: snapshot.accountState,
      capabilityCount: capabilities.size,
    });
    return true;
  }
}
