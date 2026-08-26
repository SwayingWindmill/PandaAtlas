import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import {
  CONTRIBUTION_PORT,
  type ContributionJsonValue,
  type ContributionPort,
} from "../application/contribution.application.js";
import { RegisterContributionAttachmentDto, SubmitContributionDto } from "./contribution.dto.js";

function accountId(request: FastifyRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

@Controller()
export class ContributionController {
  public constructor(
    @Inject(CONTRIBUTION_PORT) private readonly contribution: ContributionPort,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post("contributions")
  @RequireCapabilities("contribution.manage")
  public submit(@Req() request: FastifyRequest, @Body() input: SubmitContributionDto) {
    const correlationId = this.requestContext.current?.correlationId;
    if (correlationId === undefined) {
      throw new ProblemException(500, "system.internal", "The request context is unavailable.");
    }
    return this.contribution.submit({
      accountId: accountId(request),
      submissionType: input.submissionType,
      targetPandaId: input.targetPandaId,
      publicVersionSeen: input.publicVersionSeen,
      assertions: input.assertions.map((assertion) => ({
        assertionKey: assertion.assertionKey,
        fieldKey: assertion.fieldKey,
        value: assertion.value as ContributionJsonValue,
        certainty: assertion.certainty,
        lastVerifiedOn: assertion.lastVerifiedOn,
        sourceKeys: assertion.sourceKeys,
      })),
      sources: input.sources.map((source) => ({
        sourceKey: source.sourceKey,
        sourceKind: source.sourceKind,
        title: source.title,
        locator: source.locator,
        ...(source.publisher === undefined ? {} : { publisher: source.publisher }),
        ...(source.publishedOn === undefined ? {} : { publishedOn: source.publishedOn }),
      })),
      correlationId,
    });
  }

  @Get("me/contributions/:submissionId")
  @RequireCapabilities("contribution.read")
  public async getOwn(
    @Req() request: FastifyRequest,
    @Param("submissionId", ParseUUIDPipe) submissionId: string,
  ) {
    const contribution = await this.contribution.getOwn(accountId(request), submissionId);
    if (contribution === undefined) {
      throw new ProblemException(404, "contribution.notFound", "The contribution does not exist.");
    }
    return contribution;
  }

  @Post("contributions/:submissionId/attachments")
  @RequireCapabilities("contribution.manage")
  public async registerAttachment(
    @Req() request: FastifyRequest,
    @Param("submissionId", ParseUUIDPipe) submissionId: string,
    @Body() input: RegisterContributionAttachmentDto,
  ) {
    const attachment = await this.contribution.registerAttachment({
      accountId: accountId(request),
      submissionId,
      storageObjectKey: input.storageObjectKey,
      objectVersion: input.objectVersion,
      originalFilename: input.originalFilename,
      mediaType: input.mediaType,
      byteSize: input.byteSize,
      contentSha256: input.contentSha256,
    });
    if (attachment === undefined) {
      throw new ProblemException(404, "contribution.notFound", "The contribution does not exist.");
    }
    return attachment;
  }
}
