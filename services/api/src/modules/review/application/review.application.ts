import type { ContributionReviewPort } from "../../contribution/application/contribution.application.js";
import type { CurationIntakePort } from "../../curation/application/curation.application.js";
import type { EvidencePort } from "../../evidence/application/evidence.application.js";

export type ReviewDecisionOutcome = "accepted" | "not_accepted" | "duplicate" | "out_of_scope" | "abuse";
export type ReviewSourceVerificationOutcome = "verified" | "rejected";

export interface ReviewCase {
  reviewCaseId: string;
  submissionId: string;
  revisionNumber: number;
  state: string;
  version: number;
  primaryAssigneeId?: string;
}

export interface ReviewSourceVerificationInput {
  sourceId: string;
  outcome: ReviewSourceVerificationOutcome;
  normalizedLocator?: string;
  canonicalSourceId?: string;
  reason: string;
}

export interface ReviewDecisionInput {
  outcome: ReviewDecisionOutcome;
  selectedAssertionKeys: string[];
  userVisibleExplanation: string;
  internalReason?: string;
  duplicateOfReviewCaseId?: string;
}

export interface ReviewVerifiedSource {
  submittedSourceId: string;
  canonicalSourceId: string;
}

export interface ReviewRecommendationBundle {
  reviewCase: ReviewCase;
  decisionId: string;
  selectedAssertionKeys: string[];
  verifiedSources: ReviewVerifiedSource[];
}

export interface ReviewRepository {
  openCase(submissionId: string, revisionNumber: number): Promise<ReviewCase>;
  getCase(reviewCaseId: string): Promise<ReviewCase | undefined>;
  claim(reviewCaseId: string, actorAccountId: string): Promise<ReviewCase | undefined>;
  verifySource(
    reviewCaseId: string,
    actorAccountId: string,
    revisionNumber: number,
    input: ReviewSourceVerificationInput,
  ): Promise<boolean>;
  recordDecision(
    reviewCaseId: string,
    actorAccountId: string,
    revisionNumber: number,
    input: ReviewDecisionInput,
  ): Promise<string | undefined>;
  getRecommendationBundle(reviewCaseId: string): Promise<ReviewRecommendationBundle | undefined>;
  recordRecommendation(
    bundle: ReviewRecommendationBundle,
    actorAccountId: string,
    reason: string,
    correlationId: string,
  ): Promise<ReviewRecommendationBundle | undefined>;
}

export interface ReviewPort {
  openCase(submissionId: string): Promise<ReviewCase | undefined>;
  getCase(reviewCaseId: string): Promise<ReviewCase | undefined>;
  claim(reviewCaseId: string, actorAccountId: string): Promise<ReviewCase | undefined>;
  verifySource(
    reviewCaseId: string,
    actorAccountId: string,
    input: ReviewSourceVerificationInput,
  ): Promise<"verified" | "case_not_found" | "source_not_found" | "canonical_source_not_found">;
  decide(
    reviewCaseId: string,
    actorAccountId: string,
    input: ReviewDecisionInput,
  ): Promise<"decided" | "case_not_found" | "invalid_assertion">;
  recommend(
    reviewCaseId: string,
    actorAccountId: string,
    reason: string,
    correlationId: string,
  ): Promise<{ changeSetId: string } | undefined>;
}

export const REVIEW_REPOSITORY = Symbol("REVIEW_REPOSITORY");
export const REVIEW_PORT = Symbol("REVIEW_PORT");

export class ReviewApplication implements ReviewPort {
  public constructor(
    private readonly repository: ReviewRepository,
    private readonly contributions: ContributionReviewPort,
    private readonly curation: CurationIntakePort,
    private readonly evidence: EvidencePort,
  ) {}

  public async openCase(submissionId: string): Promise<ReviewCase | undefined> {
    const surface = await this.contributions.getReviewSurface(submissionId);
    if (surface === undefined) return undefined;
    return this.repository.openCase(submissionId, surface.revisionNumber);
  }

  public getCase(reviewCaseId: string): Promise<ReviewCase | undefined> {
    return this.repository.getCase(reviewCaseId);
  }

  public claim(reviewCaseId: string, actorAccountId: string): Promise<ReviewCase | undefined> {
    return this.repository.claim(reviewCaseId, actorAccountId);
  }

  public async verifySource(
    reviewCaseId: string,
    actorAccountId: string,
    input: ReviewSourceVerificationInput,
  ): Promise<"verified" | "case_not_found" | "source_not_found" | "canonical_source_not_found"> {
    const reviewCase = await this.repository.getCase(reviewCaseId);
    if (reviewCase === undefined) return "case_not_found";
    const surface = await this.contributions.getReviewSurface(reviewCase.submissionId);
    if (surface === undefined || !surface.sources.some((source) => source.sourceId === input.sourceId)) {
      return "source_not_found";
    }
    if (input.outcome === "verified") {
      if (
        input.canonicalSourceId === undefined ||
        input.normalizedLocator === undefined ||
        (await this.evidence.getSource(input.canonicalSourceId)) === undefined
      ) {
        return "canonical_source_not_found";
      }
    }
    await this.repository.verifySource(reviewCaseId, actorAccountId, surface.revisionNumber, input);
    return "verified";
  }

  public async decide(
    reviewCaseId: string,
    actorAccountId: string,
    input: ReviewDecisionInput,
  ): Promise<"decided" | "case_not_found" | "invalid_assertion"> {
    const reviewCase = await this.repository.getCase(reviewCaseId);
    if (reviewCase === undefined) return "case_not_found";
    const surface = await this.contributions.getReviewSurface(reviewCase.submissionId);
    if (surface === undefined) return "case_not_found";
    const assertionKeys = new Set(surface.assertions.map((assertion) => assertion.assertionKey));
    if (input.selectedAssertionKeys.some((key) => !assertionKeys.has(key))) return "invalid_assertion";
    const decisionId = await this.repository.recordDecision(
      reviewCaseId,
      actorAccountId,
      surface.revisionNumber,
      input,
    );
    return decisionId === undefined ? "case_not_found" : "decided";
  }

  public async recommend(
    reviewCaseId: string,
    actorAccountId: string,
    reason: string,
    correlationId: string,
  ): Promise<{ changeSetId: string } | undefined> {
    const bundle = await this.repository.getRecommendationBundle(reviewCaseId);
    if (bundle === undefined || bundle.selectedAssertionKeys.length === 0) return undefined;
    const surface = await this.contributions.getReviewSurface(bundle.reviewCase.submissionId);
    if (surface === undefined) return undefined;
    const selected = surface.assertions.filter((assertion) =>
      bundle.selectedAssertionKeys.includes(assertion.assertionKey),
    );
    if (selected.length !== bundle.selectedAssertionKeys.length) return undefined;

    const canonicalSourceBySubmittedId = new Map(
      bundle.verifiedSources.map((source) => [source.submittedSourceId, source.canonicalSourceId]),
    );
    const curatedAssertions = selected.map((assertion) => ({
      assertionKey: assertion.assertionKey,
      fieldKey: assertion.fieldKey,
      value: assertion.value,
      certainty: assertion.certainty,
      lastVerifiedOn: assertion.lastVerifiedOn,
      sourceIds: assertion.sourceIds.flatMap((sourceId) => {
        const canonicalSourceId = canonicalSourceBySubmittedId.get(sourceId);
        return canonicalSourceId === undefined ? [] : [canonicalSourceId];
      }),
    }));
    if (
      curatedAssertions.some(
        (assertion, index) => assertion.sourceIds.length !== selected[index]?.sourceIds.length,
      )
    ) {
      return undefined;
    }

    const recorded = await this.repository.recordRecommendation(
      bundle,
      actorAccountId,
      reason,
      correlationId,
    );
    if (recorded === undefined) return undefined;

    const changeSet = await this.curation.acceptReviewRecommendation({
      reviewCaseId,
      decisionId: recorded.decisionId,
      submissionId: surface.submissionId,
      revisionNumber: surface.revisionNumber,
      targetPandaId: surface.targetPandaId,
      recommendedByAccountId: actorAccountId,
      reason,
      assertions: curatedAssertions,
    });
    return { changeSetId: changeSet.changeSetId };
  }
}
