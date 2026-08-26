import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { CURATION_PORT, type CurationPort } from "../application/curation.application.js";
import { ApproveCurationDto } from "./curation.dto.js";

function actorAccountId(request: FastifyRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

@Controller("curation/change-sets")
export class CurationController {
  public constructor(@Inject(CURATION_PORT) private readonly curation: CurationPort) {}

  @Get(":changeSetId")
  @RequireCapabilities("curation.change.read")
  public async get(@Param("changeSetId", ParseUUIDPipe) changeSetId: string) {
    const changeSet = await this.curation.get(changeSetId);
    if (changeSet === undefined) {
      throw new ProblemException(404, "curation.notFound", "The Curation change set does not exist.");
    }
    return changeSet;
  }

  @Post(":changeSetId/validate")
  @HttpCode(200)
  @RequireCapabilities("curation.change.manage")
  public async validate(
    @Req() request: FastifyRequest,
    @Param("changeSetId", ParseUUIDPipe) changeSetId: string,
  ) {
    const result = await this.curation.validate(changeSetId, actorAccountId(request));
    if (result.kind === "not_found") {
      throw new ProblemException(404, "curation.notFound", "The Curation change set does not exist.");
    }
    if (result.kind === "invalid") {
      throw new ProblemException(409, "curation.validationFailed", result.reason);
    }
    return result.changeSet;
  }

  @Post(":changeSetId/approve")
  @HttpCode(200)
  @RequireCapabilities("curation.change.approve")
  public async approve(
    @Req() request: FastifyRequest,
    @Param("changeSetId", ParseUUIDPipe) changeSetId: string,
    @Body() input: ApproveCurationDto,
  ) {
    const result = await this.curation.approveAndApply(changeSetId, actorAccountId(request), input.reason);
    if (result.kind === "not_found") {
      throw new ProblemException(404, "curation.notFound", "The Curation change set does not exist.");
    }
    if (result.kind === "not_ready") {
      throw new ProblemException(409, "curation.notReady", "The Curation change set is not ready for approval.");
    }
    if (result.kind === "approval_conflict") {
      throw new ProblemException(
        409,
        "curation.approvalConflict",
        "The change-set creator cannot approve their own substantive change.",
      );
    }
    return result.changeSet;
  }
}
