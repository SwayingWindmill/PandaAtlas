import { randomUUID } from "node:crypto";
import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IncomingMessage as HttpRequest } from "node:http";
import { Public } from "../../../platform/auth/public.decorator.js";
import { AppConfig } from "../../../platform/config/app-config.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RateLimit } from "../../../platform/rate-limit/rate-limit.decorator.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { NEWS_PORT, type NewsPort } from "../application/news.application.js";
import { assertNewsIngestAuthorized, NewsIngestGuard } from "./news-ingest.guard.js";
import {
  DecideFactCandidateDto,
  DecideNewsItemDto,
  FactCandidateDto,
  FactCandidateListQueryDto,
  NewsIngestBatchDto,
  NewsIngestResultDto,
  NewsReviewItemDto,
  NewsReviewListQueryDto,
  PublicNewsPageDto,
  PublicNewsQueryDto,
} from "./news.dto.js";

function actorAccountId(request: HttpRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

@ApiTags("News")
@Controller("news")
export class NewsController {
  public constructor(
    @Inject(NEWS_PORT) private readonly news: NewsPort,
    private readonly config: AppConfig,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    operationId: "listPublicNews",
    summary: "List published Chinese panda and venue news links with structured summaries",
  })
  @ApiOkResponse({ type: PublicNewsPageDto })
  public listPublic(@Query() query: PublicNewsQueryDto) {
    return this.news.listPublicNews({
      panda: query.panda,
      institution: query.institution,
      sourceTier: query.sourceTier,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Post("ingest")
  @HttpCode(200)
  @Public()
  @UseGuards(NewsIngestGuard)
  @RateLimit("write", { keyStrategy: "ip" })
  @ApiOperation({
    operationId: "ingestCollectorNews",
    summary: "Ingest structured news and fact-change candidates from the continuous collector",
  })
  @ApiOkResponse({ type: NewsIngestResultDto })
  public ingest(@Req() request: HttpRequest, @Body() input: NewsIngestBatchDto) {
    assertNewsIngestAuthorized(request, this.config);
    const correlationId = this.requestContext.current?.correlationId ?? randomUUID();
    return this.news.ingestBatch(input.items, correlationId);
  }

  @Get("review/items")
  @ApiBearerAuth("supabaseJwt")
  @RequireCapabilities("review.case.read")
  @ApiOperation({ operationId: "listNewsReviewItems" })
  @ApiOkResponse({ type: NewsReviewItemDto, isArray: true })
  public listReviewItems(@Query() query: NewsReviewListQueryDto) {
    return this.news.listReviewItems({
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post("review/items/:newsItemId/decision")
  @HttpCode(200)
  @ApiBearerAuth("supabaseJwt")
  @RequireCapabilities("review.case.decide")
  @RateLimit("write")
  @ApiOperation({ operationId: "decideNewsReviewItem" })
  @ApiOkResponse({ type: NewsReviewItemDto })
  public decideReviewItem(
    @Req() request: HttpRequest,
    @Param("newsItemId", ParseUUIDPipe) newsItemId: string,
    @Body() input: DecideNewsItemDto,
  ) {
    const correlationId = this.requestContext.current?.correlationId ?? randomUUID();
    return this.news.decideReviewItem({
      newsItemId,
      actorAccountId: actorAccountId(request),
      decision: input.decision,
      reviewNote: input.reviewNote,
      pandaSlugs: input.pandaSlugs,
      institutionSlug: input.institutionSlug,
      correlationId,
    });
  }

  @Get("review/fact-candidates")
  @ApiBearerAuth("supabaseJwt")
  @RequireCapabilities("review.case.read")
  @ApiOperation({ operationId: "listNewsFactCandidates" })
  @ApiOkResponse({ type: FactCandidateDto, isArray: true })
  public listFactCandidates(@Query() query: FactCandidateListQueryDto) {
    return this.news.listFactCandidates({
      reviewState: query.reviewState,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post("review/fact-candidates/:candidateId/decision")
  @HttpCode(200)
  @ApiBearerAuth("supabaseJwt")
  @RequireCapabilities("review.case.decide")
  @RateLimit("write")
  @ApiOperation({ operationId: "decideNewsFactCandidate" })
  @ApiOkResponse({ type: FactCandidateDto })
  public decideFactCandidate(
    @Req() request: HttpRequest,
    @Param("candidateId", ParseUUIDPipe) candidateId: string,
    @Body() input: DecideFactCandidateDto,
  ) {
    const correlationId = this.requestContext.current?.correlationId ?? randomUUID();
    return this.news.decideFactCandidate({
      candidateId,
      actorAccountId: actorAccountId(request),
      decision: input.decision,
      reviewNote: input.reviewNote,
      targetPandaSlug: input.targetPandaSlug,
      targetInstitutionSlug: input.targetInstitutionSlug,
      correlationId,
    });
  }
}
