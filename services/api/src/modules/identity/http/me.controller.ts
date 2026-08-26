import { Controller, Get, Inject, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { getVerifiedIdentity } from "../../../platform/auth/request-auth.js";
import { AccountProvisioningBlockedError } from "../application/identity.errors.js";
import { IDENTITY_PORT, type IdentityPort } from "../application/identity.port.js";
import { AllowUnprovisioned, RequireCapabilities } from "./access.metadata.js";
import { getActorContext } from "./request-actor.js";

@Controller("me")
export class MeController {
  public constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post("account")
  @AllowUnprovisioned()
  public async provisionAccount(@Req() request: FastifyRequest): Promise<{
    accountId: string;
    state: "active";
    capabilities: string[];
  }> {
    const verified = getVerifiedIdentity(request);
    const correlationId = this.requestContext.current?.correlationId;
    if (verified === undefined || correlationId === undefined) {
      throw new ProblemException(500, "system.internal", "The request context is unavailable.");
    }

    try {
      const snapshot = await this.identity.provisionAccount(verified.accountId, correlationId);
      return {
        accountId: snapshot.accountId,
        state: "active",
        capabilities: [...snapshot.capabilities.keys()].sort(),
      };
    } catch (error) {
      if (error instanceof AccountProvisioningBlockedError) {
        throw new ProblemException(
          403,
          "authorization.accountInactive",
          "The application account cannot be provisioned in its current state.",
        );
      }
      throw error;
    }
  }

  @Get()
  @RequireCapabilities("account.session.read")
  public getCurrentAccount(@Req() request: FastifyRequest): {
    accountId: string;
    aal: "aal1" | "aal2";
    capabilities: string[];
  } {
    const actor = getActorContext(request);
    if (actor === undefined) {
      throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
    }
    return {
      accountId: actor.accountId,
      aal: actor.aal,
      capabilities: [...actor.capabilities].sort(),
    };
  }
}
