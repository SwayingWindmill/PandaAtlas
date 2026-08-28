import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequestContextService } from "../../../platform/request-context/request-context.service.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { REVIEW_PORT, type ReviewPort } from "../application/review.application.js";
import {
  OpenReviewCaseDto,
  RecommendReviewDto,
  RecordReviewDecisionDto,
  ReviewCaseDto,
  ReviewDecisionResultDto,
  ReviewRecommendationDto,
  ReviewVerificationResultDto,
  VerifyReviewSourceDto,
} from "./review.dto.js";

function actorAccountId(request: FastifyRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

@ApiTags("Review")
@Controller("review/cases")
export class ReviewController {
  public constructor(
    @Inject(REVIEW_PORT) private readonly review: ReviewPort,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post()
  @RequireCapabilities("review.case.intake")
  @ApiOperation({ operationId: "openReviewCase" })
  @ApiCreatedResponse({ type: ReviewCaseDto })
  public async open(@Body() input: OpenReviewCaseDto) {
    const reviewCase = await this.review.openCase(input.submissionId);
    if (reviewCase === undefined) {
      throw new ProblemException(404, "review.submissionNotFound", "The submitted contribution does not exist.");
    }
    return reviewCase;
  }

  @Get(":reviewCaseId")
  @RequireCapabilities("review.case.read")
  @ApiOperation({ operationId: "getReviewCase" })
  @ApiOkResponse({ type: ReviewCaseDto })
  public async get(@Param("reviewCaseId", ParseUUIDPipe) reviewCaseId: string) {
    const reviewCase = await this.review.getCase(reviewCaseId);
    if (reviewCase === undefined) {
      throw new ProblemException(404, "review.caseNotFound", "The ReviewCase does not exist.");
    }
    return reviewCase;
  }

  @Post(":reviewCaseId/claim")
  @HttpCode(200)
  @RequireCapabilities("review.case.claim")
  @ApiOperation({ operationId: "claimReviewCase" })
  @ApiOkResponse({ type: ReviewCaseDto })
  public async claim(
    @Req() request: FastifyRequest,
    @Param("reviewCaseId", ParseUUIDPipe) reviewCaseId: string,
  ) {
    const reviewCase = await this.review.claim(reviewCaseId, actorAccountId(request));
    if (reviewCase === undefined) {
      throw new ProblemException(409, "review.caseNotClaimable", "The ReviewCase cannot be claimed.");
    }
    return reviewCase;
  }

  @Post(":reviewCaseId/source-verifications")
  @RequireCapabilities("review.case.verify_source")
  @ApiOperation({ operationId: "verifyReviewSource" })
  @ApiCreatedResponse({ type: ReviewVerificationResultDto })
  public async verifySource(
    @Req() request: FastifyRequest,
    @Param("reviewCaseId", ParseUUIDPipe) reviewCaseId: string,
    @Body() input: VerifyReviewSourceDto,
  ) {
    const result = await this.review.verifySource(reviewCaseId, actorAccountId(request), input);
    if (result === "case_not_found") {
      throw new ProblemException(404, "review.caseNotFound", "The ReviewCase does not exist.");
    }
    if (result === "source_not_found") {
      throw new ProblemException(404, "review.sourceNotFound", "The submitted source does not exist.");
    }
    if (result === "canonical_source_not_found") {
      throw new ProblemException(
        422,
        "review.canonicalEvidenceRequired",
        "A verified submitted source must resolve to an existing canonical Evidence source.",
      );
    }
    return { verified: true as const };
  }

  @Post(":reviewCaseId/decision")
  @HttpCode(200)
  @RequireCapabilities("review.case.decide")
  @ApiOperation({ operationId: "decideReviewCase" })
  @ApiOkResponse({ type: ReviewDecisionResultDto })
  public async decide(
    @Req() request: FastifyRequest,
    @Param("reviewCaseId", ParseUUIDPipe) reviewCaseId: string,
    @Body() input: RecordReviewDecisionDto,
  ) {
    const result = await this.review.decide(reviewCaseId, actorAccountId(request), input);
    if (result === "case_not_found") {
      throw new ProblemException(404, "review.caseNotFound", "The ReviewCase does not exist or is not decidable.");
    }
    if (result === "invalid_assertion") {
      throw new ProblemException(422, "review.invalidAssertion", "A selected assertion is not in the active revision.");
    }
    return { decided: true as const };
  }

  @Post(":reviewCaseId/recommend")
  @HttpCode(200)
  @RequireCapabilities("review.case.recommend")
  @ApiOperation({ operationId: "recommendReviewCase" })
  @ApiOkResponse({ type: ReviewRecommendationDto })
  public async recommend(
    @Req() request: FastifyRequest,
    @Param("reviewCaseId", ParseUUIDPipe) reviewCaseId: string,
    @Body() input: RecommendReviewDto,
  ) {
    const correlationId = this.requestContext.current?.correlationId;
    if (correlationId === undefined) {
      throw new ProblemException(500, "system.internal", "The request context is unavailable.");
    }
    const result = await this.review.recommend(
      reviewCaseId,
      actorAccountId(request),
      input.reason,
      correlationId,
    );
    if (result === undefined) {
      throw new ProblemException(
        409,
        "review.notRecommendable",
        "The ReviewCase is missing an accepted decision or verified canonical evidence.",
      );
    }
    return result;
  }
}
