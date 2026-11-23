import { Body, Controller, Get, Inject, Optional, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IncomingMessage as HttpRequest } from "node:http";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { OpsAlertService } from "../../../platform/observability/ops-alert.service.js";
import { RateLimit } from "../../../platform/rate-limit/rate-limit.decorator.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { PRIVACY_PORT, type PrivacyPort } from "../application/privacy.application.js";
import { CreatePrivacyRequestDto, PrivacyExportDto, PrivacyRequestDto, PrivacyRequestListDto } from "./privacy.dto.js";

@ApiTags("Privacy")
@ApiBearerAuth("supabaseJwt")
@Controller("me/privacy/requests")
export class PrivacyController {
  public constructor(
    @Inject(PRIVACY_PORT) private readonly privacy: PrivacyPort,
    private readonly requestContext: RequestContextService,
    @Optional() private readonly opsAlert?: OpsAlertService,
  ) {}

  @Post()
  @RequireCapabilities("privacy.request.manage")
  @RateLimit("sensitive", { keyStrategy: "ip_and_account" })
  @ApiOperation({ operationId: "createMyPrivacyRequest", summary: "Create an asynchronous privacy request" })
  @ApiCreatedResponse({ type: PrivacyRequestDto })
  public async create(@Req() request: HttpRequest, @Body() input: CreatePrivacyRequestDto) {
    const { accountId, correlationId } = this.context(request);
    const created = await this.privacy.create(accountId, {
      kind: input.kind,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      correlationId,
    });
    if (created.kind === "account_deletion") {
      void this.opsAlert?.notify({
        severity: "warning",
        category: "account_deletion_requested",
        title: "收到账号注销申请",
        summary: `Account deletion request (${created.requestId})`,
        dedupeKey: `privacy:${created.requestId}`,
        cooldownMs: 300_000,
        metadata: {
          privacyRequestId: created.requestId,
          kind: created.kind,
          requestId: this.requestContext.current?.requestId,
        },
      });
    }
    return created;
  }

  @Get()
  @RequireCapabilities("privacy.request.manage")
  @ApiOperation({ operationId: "listMyPrivacyRequests", summary: "List the account's privacy requests, newest first" })
  @ApiOkResponse({ type: PrivacyRequestListDto })
  public async list(@Req() request: HttpRequest) {
    return { items: await this.privacy.list(this.context(request).accountId) };
  }

  @Get(":requestId")
  @RequireCapabilities("privacy.request.manage")
  @ApiOperation({ operationId: "getMyPrivacyRequest", summary: "Read one privacy request state" })
  @ApiOkResponse({ type: PrivacyRequestDto })
  public async get(@Req() request: HttpRequest, @Param("requestId", ParseUUIDPipe) requestId: string) {
    const record = await this.privacy.get(this.context(request).accountId, requestId);
    if (record === undefined) {
      throw new ProblemException(404, "privacy.requestNotFound", "The privacy request does not exist.");
    }
    return record;
  }

  @Get(":requestId/export")
  @RequireCapabilities("privacy.request.manage")
  @ApiOperation({ operationId: "getMyPrivacyExport", summary: "Read a completed, unexpired privacy export snapshot" })
  @ApiOkResponse({ type: PrivacyExportDto })
  public async getExport(@Req() request: HttpRequest, @Param("requestId", ParseUUIDPipe) requestId: string) {
    const accountId = this.context(request).accountId;
    const exported = await this.privacy.getExport(accountId, requestId);
    if (exported !== undefined) return exported;
    const record = await this.privacy.get(accountId, requestId);
    if (record === undefined) {
      throw new ProblemException(404, "privacy.requestNotFound", "The privacy request does not exist.");
    }
    if (record.kind !== "access_export") {
      throw new ProblemException(404, "privacy.exportNotFound", "This privacy request does not produce an export.");
    }
    throw new ProblemException(409, "privacy.exportNotReady", "The privacy export is not ready or has expired.");
  }

  private context(request: HttpRequest): { accountId: string; correlationId: string } {
    const actor = getActorContext(request);
    const correlationId = this.requestContext.current?.correlationId;
    if (actor === undefined || correlationId === undefined) {
      throw new ProblemException(500, "system.internal", "The privacy request context is unavailable.");
    }
    return { accountId: actor.accountId, correlationId };
  }
}
