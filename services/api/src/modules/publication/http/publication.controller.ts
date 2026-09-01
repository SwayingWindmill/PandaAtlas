import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import {
  PUBLICATION_PORT,
  type PublicRelease,
  type PublicationCommandContext,
  type PublicationPort,
  type PublicationReleaseResult,
} from "../application/publication.application.js";
import {
  BuildPublicReleaseDto,
  PublicationReasonDto,
  PublicationResourceControlDto,
  PublicReleaseDto,
} from "./publication.dto.js";

function publicationRelease(result: PublicationReleaseResult): PublicRelease {
  switch (result.kind) {
    case "ok":
    case "already_current":
      return result.release;
    case "not_found":
      throw new ProblemException(404, "publication.releaseNotFound", "The public release does not exist.");
    case "not_ready":
      throw new ProblemException(409, "publication.releaseNotReady", "The public release is not ready for this transition.");
    case "incompatible":
      throw new ProblemException(409, "publication.releaseIncompatible", "The rollback target uses an incompatible projection schema.");
    case "not_older":
      throw new ProblemException(409, "publication.rollbackTargetNotOlder", "Rollback requires an older sealed release.");
    case "not_forward":
      throw new ProblemException(409, "publication.activationNotForward", "Activation requires a newer sealed release; use rollback for an older release.");
    case "suspended":
      throw new ProblemException(409, "publication.releaseSuspended", "A suspended release cannot become current until restored.");
  }
}

@ApiTags("Publication")
@ApiBearerAuth("supabaseJwt")
@Controller("publication")
export class PublicationController {
  public constructor(
    @Inject(PUBLICATION_PORT) private readonly publication: PublicationPort,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get("releases/:releaseId")
  @RequireCapabilities("publication.release.manage")
  @ApiOperation({ operationId: "getPublicationRelease", summary: "Get a V2 public release lifecycle record" })
  @ApiOkResponse({ type: PublicReleaseDto })
  @ApiNotFoundResponse({ description: "The release does not exist." })
  public async getRelease(@Param("releaseId", new ParseUUIDPipe({ version: "4" })) releaseId: string) {
    const release = await this.publication.getRelease(releaseId);
    if (release === undefined) {
      throw new ProblemException(404, "publication.releaseNotFound", "The public release does not exist.");
    }
    return release;
  }

  @Post("releases")
  @RequireCapabilities("publication.release.manage")
  @ApiOperation({ operationId: "buildPublicationRelease", summary: "Build a release-scoped public projection" })
  @ApiCreatedResponse({ type: PublicReleaseDto })
  public build(@Req() request: FastifyRequest, @Body() input: BuildPublicReleaseDto) {
    return this.publication.build(input.version, this.commandContext(request));
  }

  @Post("releases/:releaseId/seal")
  @HttpCode(200)
  @RequireCapabilities("publication.release.manage")
  @ApiOperation({ operationId: "sealPublicationRelease", summary: "Seal a built release immutably" })
  @ApiOkResponse({ type: PublicReleaseDto })
  @ApiNotFoundResponse({ description: "The release does not exist." })
  @ApiConflictResponse({ description: "The release has no publishable membership yet." })
  public async seal(
    @Req() request: FastifyRequest,
    @Param("releaseId", new ParseUUIDPipe({ version: "4" })) releaseId: string,
    @Body() input: PublicationReasonDto,
  ) {
    return publicationRelease(await this.publication.seal(releaseId, this.commandContext(request), input.reason));
  }

  @Post("releases/:releaseId/activate")
  @HttpCode(200)
  @RequireCapabilities("publication.release.activate")
  @ApiOperation({ operationId: "activatePublicationRelease", summary: "Atomically activate a newer sealed release" })
  @ApiOkResponse({ type: PublicReleaseDto })
  @ApiConflictResponse({ description: "The release is not a valid forward activation target." })
  public async activate(
    @Req() request: FastifyRequest,
    @Param("releaseId", new ParseUUIDPipe({ version: "4" })) releaseId: string,
    @Body() input: PublicationReasonDto,
  ) {
    return publicationRelease(await this.publication.activate(releaseId, this.commandContext(request), input.reason));
  }

  @Post("releases/:releaseId/rollback")
  @HttpCode(200)
  @RequireCapabilities("publication.release.activate")
  @ApiOperation({ operationId: "rollbackPublicationRelease", summary: "Atomically reactivate an older compatible sealed release" })
  @ApiOkResponse({ type: PublicReleaseDto })
  @ApiConflictResponse({ description: "The release is not a valid rollback target." })
  public async rollback(
    @Req() request: FastifyRequest,
    @Param("releaseId", new ParseUUIDPipe({ version: "4" })) releaseId: string,
    @Body() input: PublicationReasonDto,
  ) {
    return publicationRelease(await this.publication.rollback(releaseId, this.commandContext(request), input.reason));
  }

  @Post("releases/:releaseId/suspend")
  @HttpCode(200)
  @RequireCapabilities("publication.emergency")
  @ApiOperation({ operationId: "suspendPublicationRelease", summary: "Apply emergency whole-release suspension" })
  @ApiOkResponse({ type: PublicReleaseDto })
  public async suspend(
    @Req() request: FastifyRequest,
    @Param("releaseId", new ParseUUIDPipe({ version: "4" })) releaseId: string,
    @Body() input: PublicationReasonDto,
  ) {
    return publicationRelease(
      await this.publication.setReleaseSuspension(releaseId, true, this.commandContext(request), input.reason),
    );
  }

  @Post("releases/:releaseId/restore")
  @HttpCode(200)
  @RequireCapabilities("publication.emergency")
  @ApiOperation({ operationId: "restorePublicationRelease", summary: "Restore a suspended release" })
  @ApiOkResponse({ type: PublicReleaseDto })
  public async restore(
    @Req() request: FastifyRequest,
    @Param("releaseId", new ParseUUIDPipe({ version: "4" })) releaseId: string,
    @Body() input: PublicationReasonDto,
  ) {
    return publicationRelease(
      await this.publication.setReleaseSuspension(releaseId, false, this.commandContext(request), input.reason),
    );
  }

  @Post("resources/takedown")
  @HttpCode(204)
  @RequireCapabilities("publication.emergency")
  @ApiOperation({ operationId: "takeDownPublicationResource", summary: "Apply a narrow emergency resource takedown" })
  @ApiNoContentResponse()
  public async takeDownResource(
    @Req() request: FastifyRequest,
    @Body() input: PublicationResourceControlDto,
  ): Promise<void> {
    await this.publication.setResourceTakedown(
      input.resourceKind,
      input.resourceId,
      true,
      this.commandContext(request),
      input.reason,
    );
  }

  @Post("resources/restore")
  @HttpCode(204)
  @RequireCapabilities("publication.emergency")
  @ApiOperation({ operationId: "restorePublicationResource", summary: "Restore an emergency-taken-down resource" })
  @ApiNoContentResponse()
  public async restoreResource(
    @Req() request: FastifyRequest,
    @Body() input: PublicationResourceControlDto,
  ): Promise<void> {
    await this.publication.setResourceTakedown(
      input.resourceKind,
      input.resourceId,
      false,
      this.commandContext(request),
      input.reason,
    );
  }

  private commandContext(request: FastifyRequest): PublicationCommandContext {
    const actor = getActorContext(request);
    const correlationId = this.requestContext.current?.correlationId;
    if (actor === undefined || correlationId === undefined) {
      throw new ProblemException(500, "system.internal", "The publication command context is unavailable.");
    }
    return { actor: { kind: "account", accountId: actor.accountId }, correlationId };
  }
}
