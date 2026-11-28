import { Body, Controller, Get, HttpCode, Inject, Post, Put, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IncomingMessage as HttpRequest } from "node:http";
import { getVerifiedIdentity } from "../../../platform/auth/request-auth.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RateLimit } from "../../../platform/rate-limit/rate-limit.decorator.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import {
  APPLE_TOKEN_REVOCATION_PORT,
  AppleAuthorizationCodeInvalidError,
  type AppleTokenRevocationPort,
} from "../application/apple-token-revocation.port.js";
import { AccountProvisioningBlockedError } from "../application/identity.errors.js";
import { IDENTITY_PORT, type IdentityPort } from "../application/identity.port.js";
import { AllowUnprovisioned, RequireCapabilities } from "./access.metadata.js";
import {
  CurrentAccountDto,
  FanProfileDto,
  ProvisionedAccountDto,
  ReplaceProfileDto,
  StoreAppleTokenDto,
  StoreAppleTokenResponseDto,
} from "./profile.dto.js";
import { getActorContext } from "./request-actor.js";

@ApiTags("Identity")
@Controller("me")
export class MeController {
  public constructor(
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
    @Inject(APPLE_TOKEN_REVOCATION_PORT) private readonly appleRevocation: AppleTokenRevocationPort,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post("account")
  @AllowUnprovisioned()
  @RateLimit("sensitive", { keyStrategy: "ip_and_account" })
  @ApiOperation({ operationId: "provisionCurrentAccount" })
  @ApiCreatedResponse({ type: ProvisionedAccountDto })
  public async provisionAccount(@Req() request: HttpRequest): Promise<{
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
  @ApiOperation({ operationId: "getCurrentAccount" })
  @ApiOkResponse({ type: CurrentAccountDto })
  public getCurrentAccount(@Req() request: HttpRequest): {
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

  @Get("profile")
  @RequireCapabilities("account.profile.read")
  @ApiOperation({ operationId: "getCurrentProfile" })
  @ApiOkResponse({ type: FanProfileDto })
  public async getProfile(@Req() request: HttpRequest) {
    const actor = getActorContext(request);
    if (actor === undefined) {
      throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
    }
    return this.identity.getProfile(actor.accountId);
  }

  @Put("profile")
  @RequireCapabilities("account.profile.manage")
  @RateLimit("write")
  @ApiOperation({ operationId: "replaceCurrentProfile" })
  @ApiOkResponse({ type: FanProfileDto })
  public async replaceProfile(@Req() request: HttpRequest, @Body() input: ReplaceProfileDto) {
    const actor = getActorContext(request);
    if (actor === undefined) {
      throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
    }
    return this.identity.replaceProfile(actor.accountId, input);
  }

  @Post("apple-token")
  @HttpCode(200)
  @RequireCapabilities("account.session.read")
  @RateLimit("sensitive", { keyStrategy: "ip_and_account" })
  @ApiOperation({ operationId: "storeAppleRevocationToken" })
  @ApiOkResponse({ type: StoreAppleTokenResponseDto })
  public async storeAppleRevocationToken(
    @Req() request: HttpRequest,
    @Body() input: StoreAppleTokenDto,
  ): Promise<{ stored: boolean }> {
    const actor = getActorContext(request);
    if (actor === undefined) {
      throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
    }
    try {
      return await this.appleRevocation.storeFromAuthorizationCode(actor.accountId, input.authorizationCode);
    } catch (error) {
      if (error instanceof AppleAuthorizationCodeInvalidError) {
        throw new ProblemException(
          400,
          "identity.appleAuthorizationCodeInvalid",
          "The Apple authorization code could not be exchanged.",
        );
      }
      throw error;
    }
  }
}
