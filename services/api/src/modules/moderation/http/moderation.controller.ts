import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import {
  AllowSuspendedAccount,
  RequireCapabilities,
} from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { MODERATION_PORT, type ModerationPort } from "../application/moderation.application.js";
import {
  ApplySanctionDto,
  DecideAppealDto,
  RestoreSanctionDto,
  SubmitAppealDto,
} from "./moderation.dto.js";

function actorAccountId(request: FastifyRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

@Controller("moderation")
export class ModerationController {
  public constructor(
    @Inject(MODERATION_PORT) private readonly moderation: ModerationPort,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get("accounts/:accountId")
  @RequireCapabilities("moderation.sanction.read")
  public async getAccount(@Param("accountId", ParseUUIDPipe) accountId: string) {
    return {
      subject: await this.moderation.getSubject(accountId),
      sanctions: await this.moderation.listSanctions(accountId),
    };
  }

  @Post("accounts/:accountId/sanctions")
  @RequireCapabilities("moderation.sanction.apply")
  public async applySanction(
    @Req() request: FastifyRequest,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @Body() input: ApplySanctionDto,
  ) {
    const correlationId = this.correlationId();
    return this.moderation.applySanction({
      accountId,
      kind: input.kind,
      reasonCode: input.reasonCode,
      internalExplanation: input.internalExplanation,
      userVisibleExplanation: input.userVisibleExplanation,
      ...(input.endsAt === undefined ? {} : { endsAt: new Date(input.endsAt) }),
      actorAccountId: actorAccountId(request),
      correlationId,
      idempotencyKey: input.idempotencyKey,
    });
  }

  @Post("sanctions/:sanctionId/restore")
  @HttpCode(200)
  @RequireCapabilities("moderation.sanction.restore")
  public async restoreSanction(
    @Req() request: FastifyRequest,
    @Param("sanctionId", ParseUUIDPipe) sanctionId: string,
    @Body() input: RestoreSanctionDto,
  ) {
    const restored = await this.moderation.restoreSanction({
      sanctionId,
      reasonCode: input.reasonCode,
      internalExplanation: input.internalExplanation,
      userVisibleExplanation: input.userVisibleExplanation,
      actorAccountId: actorAccountId(request),
      correlationId: this.correlationId(),
      idempotencyKey: input.idempotencyKey,
    });
    if (!restored) {
      throw new ProblemException(409, "moderation.notRestorable", "The sanction is not the current restorable sanction.");
    }
    return { restored: true };
  }

  @Post("appeals/:appealCaseId/decision")
  @HttpCode(200)
  @RequireCapabilities("moderation.appeal.decide")
  public async decideAppeal(
    @Req() request: FastifyRequest,
    @Param("appealCaseId", ParseUUIDPipe) appealCaseId: string,
    @Body() input: DecideAppealDto,
  ) {
    const decision = await this.moderation.decideAppeal(
      appealCaseId,
      actorAccountId(request),
      input.outcome,
      input.internalExplanation,
      input.userVisibleExplanation,
      this.correlationId(),
    );
    if (decision === undefined) {
      throw new ProblemException(409, "moderation.appealNotDecidable", "The appeal cannot be decided.");
    }
    return decision;
  }

  private correlationId(): string {
    const correlationId = this.requestContext.current?.correlationId;
    if (correlationId === undefined) {
      throw new ProblemException(500, "system.internal", "The request context is unavailable.");
    }
    return correlationId;
  }
}

@Controller("me/moderation")
export class OwnModerationController {
  public constructor(@Inject(MODERATION_PORT) private readonly moderation: ModerationPort) {}

  @Post("appeals")
  @AllowSuspendedAccount()
  @RequireCapabilities("moderation.appeal.submit")
  public async submitAppeal(@Req() request: FastifyRequest, @Body() input: SubmitAppealDto) {
    const appeal = await this.moderation.submitAppeal(
      actorAccountId(request),
      input.sanctionId,
      input.userStatement,
    );
    if (appeal === undefined) {
      throw new ProblemException(404, "moderation.sanctionNotFound", "The sanction does not belong to this account.");
    }
    return appeal;
  }
}
