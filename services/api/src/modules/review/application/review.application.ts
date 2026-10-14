import type {
  ContributionCertainty,
  ContributionJsonValue,
  ContributionReviewPort,
  ContributionReviewStatus,
  ContributionReviewSurface,
} from "../../contribution/application/contribution.application.js";
import type { EvidencePort } from "../../evidence/application/evidence.application.js";

export type ReviewDecisionOutcome = "accepted" | "not_accepted" | "duplicate" | "out_of_scope" | "abuse";
export type ReviewSourceVerificationOutcome = "verified" | "rejected";
export const REVIEW_CASE_STATES = ["new", "assigned", "closed"] as const;
export type ReviewCaseState = (typeof REVIEW_CASE_STATES)[number];

const CONTRIBUTOR_STATUS_BY_OUTCOME: Record<ReviewDecisionOutcome, ContributionReviewStatus> = {
  accepted: "accepted",
  not_accepted: "not_accepted",
  duplicate: "duplicate",
  out_of_scope: "out_of_scope",
  abuse: "not_accepted",
};

export interface ReviewCase {
  reviewCaseId: string;
  submissionId: string;
  revisionNumber: number;
  state: ReviewCaseState;
  version: number;
  primaryAssigneeId?: string;
}

export interface ReviewCaseQueueItem extends ReviewCase {
  riskLevel: string;
  targetPandaId?: string;
  contributorStatus?: string;
  createdAt: Date;
  updatedAt: Date;
  firstResponseDueAt: Date;
  slaOverdue: boolean;
  queueAgeSeconds: number;
}

export interface ReviewCaseListQuery {
  state?: ReviewCaseState;
  limit: number;
  offset: number;
}

export interface ReviewCasePage {
  items: ReviewCaseQueueItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReviewCaseSurface {
  reviewCase: ReviewCase;
  contribution: ContributionReviewSurface;
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

// An accepted assertion, cited by canonical Evidence sources, that the decision writes to its Panda.
export interface ReviewAcceptedFact {
  assertionKey: string;
  fieldKey: string;
  value: ContributionJsonValue;
  certainty: ContributionCertainty;
  lastVerifiedOn: string;
  sourceIds: string[];
}

export interface ReviewDecisionRecord {
  reviewCaseId: string;
  actorAccountId: string;
  submissionId: string;
  revisionNumber: number;
  targetPandaId: string;
  decision: ReviewDecisionInput;
  contributorStatus: ContributionReviewStatus;
  acceptedFacts: ReviewAcceptedFact[];
  correlationId: string;
}

export type ReviewDecisionResult = "decided" | "case_not_found" | "invalid_assertion" | "source_not_verified";

export interface ReviewRepository {
  openCase(submissionId: string, revisionNumber: number): Promise<ReviewCase>;
  listCases(query: ReviewCaseListQuery): Promise<ReviewCasePage>;
  getCase(reviewCaseId: string): Promise<ReviewCase | undefined>;
  claim(reviewCaseId: string, actorAccountId: string): Promise<ReviewCase | undefined>;
  verifySource(
    reviewCaseId: string,
    actorAccountId: string,
    revisionNumber: number,
    input: ReviewSourceVerificationInput,
  ): Promise<boolean>;
  // The latest verification of each submitted source, when it resolved to canonical Evidence.
  listVerifiedSources(reviewCaseId: string, revisionNumber: number): Promise<ReviewVerifiedSource[]>;
  // Records the decision, writes its accepted facts and the contributor's outcome, and closes the case,
  // all in one transaction. Returns undefined when the actor does not hold the open case.
  recordDecision(record: ReviewDecisionRecord): Promise<string | undefined>;
}

export interface ReviewPort {
  openCase(submissionId: string): Promise<ReviewCase | undefined>;
  listCases(query: ReviewCaseListQuery): Promise<ReviewCasePage>;
  getCase(reviewCaseId: string): Promise<ReviewCase | undefined>;
  getSurface(reviewCaseId: string): Promise<ReviewCaseSurface | undefined>;
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
    correlationId: string,
  ): Promise<ReviewDecisionResult>;
}

export const REVIEW_REPOSITORY = Symbol("REVIEW_REPOSITORY");
export const REVIEW_PORT = Symbol("REVIEW_PORT");

export class ReviewApplication implements ReviewPort {
  public constructor(
    private readonly repository: ReviewRepository,
    private readonly contributions: ContributionReviewPort,
    private readonly evidence: EvidencePort,
  ) {}

  public async openCase(submissionId: string): Promise<ReviewCase | undefined> {
    const surface = await this.contributions.getReviewSurface(submissionId);
    if (surface === undefined) return undefined;
    return this.repository.openCase(submissionId, surface.revisionNumber);
  }

  public listCases(query: ReviewCaseListQuery): Promise<ReviewCasePage> {
    return this.repository.listCases(query);
  }

  public getCase(reviewCaseId: string): Promise<ReviewCase | undefined> {
    return this.repository.getCase(reviewCaseId);
  }

  public async getSurface(reviewCaseId: string): Promise<ReviewCaseSurface | undefined> {
    const reviewCase = await this.repository.getCase(reviewCaseId);
    if (reviewCase === undefined) return undefined;
    const contribution = await this.contributions.getReviewSurface(reviewCase.submissionId);
    return contribution === undefined ? undefined : { reviewCase, contribution };
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
    correlationId: string,
  ): Promise<ReviewDecisionResult> {
    const reviewCase = await this.repository.getCase(reviewCaseId);
    if (reviewCase === undefined) return "case_not_found";
    const surface = await this.contributions.getReviewSurface(reviewCase.submissionId);
    if (surface === undefined) return "case_not_found";
    const selected = surface.assertions.filter((assertion) =>
      input.selectedAssertionKeys.includes(assertion.assertionKey),
    );
    if (selected.length !== new Set(input.selectedAssertionKeys).size) return "invalid_assertion";

    let acceptedFacts: ReviewAcceptedFact[] = [];
    if (input.outcome === "accepted") {
      if (selected.length === 0) return "invalid_assertion";
      const canonicalSourceBySubmittedId = new Map(
        (await this.repository.listVerifiedSources(reviewCaseId, surface.revisionNumber)).map((source) => [
          source.submittedSourceId,
          source.canonicalSourceId,
        ]),
      );
      if (
        selected.some((assertion) =>
          assertion.sourceIds.some((sourceId) => !canonicalSourceBySubmittedId.has(sourceId)),
        )
      ) {
        return "source_not_verified";
      }
      acceptedFacts = selected.map((assertion) => ({
        assertionKey: assertion.assertionKey,
        fieldKey: assertion.fieldKey,
        value: assertion.value,
        certainty: assertion.certainty,
        lastVerifiedOn: assertion.lastVerifiedOn,
        sourceIds: assertion.sourceIds.map((sourceId) => canonicalSourceBySubmittedId.get(sourceId)!),
      }));
    }

    const decisionId = await this.repository.recordDecision({
      reviewCaseId,
      actorAccountId,
      submissionId: surface.submissionId,
      revisionNumber: surface.revisionNumber,
      targetPandaId: surface.targetPandaId,
      decision: input,
      contributorStatus: CONTRIBUTOR_STATUS_BY_OUTCOME[input.outcome],
      acceptedFacts,
      correlationId,
    });
    return decisionId === undefined ? "case_not_found" : "decided";
  }
}
