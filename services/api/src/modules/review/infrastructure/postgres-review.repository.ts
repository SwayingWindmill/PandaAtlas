import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type {
  ReviewCase,
  ReviewDecisionInput,
  ReviewRecommendationBundle,
  ReviewRepository,
  ReviewSourceVerificationInput,
} from "../application/review.application.js";

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export class PostgresReviewRepository implements ReviewRepository {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
  ) {}

  public async openCase(submissionId: string, revisionNumber: number): Promise<ReviewCase> {
    const existing = await this.database.db
      .selectFrom("review_moderation.review_cases")
      .selectAll()
      .where("submission_id", "=", submissionId)
      .where("state", "!=", "closed")
      .executeTakeFirst();
    if (existing !== undefined) return this.mapCase(existing);

    const row = await this.database.db
      .insertInto("review_moderation.review_cases")
      .values({
        submission_id: submissionId,
        opened_revision_number: revisionNumber,
        active_revision_number: revisionNumber,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.mapCase(row);
  }

  public async getCase(reviewCaseId: string): Promise<ReviewCase | undefined> {
    const row = await this.database.db
      .selectFrom("review_moderation.review_cases")
      .selectAll()
      .where("review_case_id", "=", reviewCaseId)
      .executeTakeFirst();
    return row === undefined ? undefined : this.mapCase(row);
  }

  public async claim(reviewCaseId: string, actorAccountId: string): Promise<ReviewCase | undefined> {
    const row = await this.database.db
      .updateTable("review_moderation.review_cases")
      .set({
        state: "assigned",
        primary_assignee_id: actorAccountId,
        first_responded_at: sql`coalesce(first_responded_at, now())`,
        version: sql`version + 1`,
      })
      .where("review_case_id", "=", reviewCaseId)
      .where("state", "in", ["new", "triage", "waiting", "assigned"])
      .where((expression) =>
        expression.or([
          expression("primary_assignee_id", "is", null),
          expression("primary_assignee_id", "=", actorAccountId),
        ]),
      )
      .returningAll()
      .executeTakeFirst();
    return row === undefined ? undefined : this.mapCase(row);
  }

  public async verifySource(
    reviewCaseId: string,
    actorAccountId: string,
    revisionNumber: number,
    input: ReviewSourceVerificationInput,
  ): Promise<boolean> {
    const row = await this.database.db
      .insertInto("review_moderation.source_verifications")
      .values({
        review_case_id: reviewCaseId,
        source_id: input.sourceId,
        active_revision_number: revisionNumber,
        outcome: input.outcome,
        normalized_locator: input.normalizedLocator ?? null,
        canonical_source_id: input.canonicalSourceId ?? null,
        reason: input.reason,
        verified_by_account_id: actorAccountId,
      })
      .returning("source_verification_id")
      .executeTakeFirst();
    return row !== undefined;
  }

  public async recordDecision(
    reviewCaseId: string,
    actorAccountId: string,
    revisionNumber: number,
    input: ReviewDecisionInput,
  ): Promise<string | undefined> {
    return this.database.transaction(async (transaction) => {
      const reviewCase = await transaction
        .selectFrom("review_moderation.review_cases")
        .select(["state", "primary_assignee_id"])
        .where("review_case_id", "=", reviewCaseId)
        .forUpdate()
        .executeTakeFirst();
      if (
        reviewCase === undefined ||
        reviewCase.primary_assignee_id !== actorAccountId ||
        !["assigned", "waiting", "decision_ready"].includes(reviewCase.state)
      ) {
        return undefined;
      }

      if (reviewCase.state !== "decision_ready") {
        await transaction
          .updateTable("review_moderation.review_cases")
          .set({ state: "decision_ready", version: sql`version + 1` })
          .where("review_case_id", "=", reviewCaseId)
          .executeTakeFirstOrThrow();
      }

      const decision = await transaction
        .insertInto("review_moderation.decisions")
        .values({
          review_case_id: reviewCaseId,
          active_revision_number: revisionNumber,
          outcome: input.outcome,
          user_visible_explanation: input.userVisibleExplanation,
          internal_reason: input.internalReason ?? null,
          selected_assertion_keys: sql`${JSON.stringify(input.selectedAssertionKeys)}::jsonb`,
          duplicate_of_review_case_id: input.duplicateOfReviewCaseId ?? null,
          decided_by_account_id: actorAccountId,
        })
        .returning("decision_id")
        .executeTakeFirstOrThrow();
      return decision.decision_id;
    });
  }

  public async getRecommendationBundle(reviewCaseId: string): Promise<ReviewRecommendationBundle | undefined> {
    const reviewCaseRow = await this.database.db
      .selectFrom("review_moderation.review_cases")
      .selectAll()
      .where("review_case_id", "=", reviewCaseId)
      .executeTakeFirst();
    if (reviewCaseRow === undefined) return undefined;

    const decision = await this.database.db
      .selectFrom("review_moderation.decisions")
      .select(["decision_id", "selected_assertion_keys"])
      .where("review_case_id", "=", reviewCaseId)
      .where("active_revision_number", "=", reviewCaseRow.active_revision_number)
      .where("outcome", "=", "accepted")
      .orderBy("decided_at", "desc")
      .orderBy("decision_id", "desc")
      .executeTakeFirst();
    if (decision === undefined) return undefined;

    const verificationRows = await this.database.db
      .selectFrom("review_moderation.source_verifications")
      .select(["source_id", "canonical_source_id", "outcome"])
      .where("review_case_id", "=", reviewCaseId)
      .where("active_revision_number", "=", reviewCaseRow.active_revision_number)
      .orderBy("source_id")
      .orderBy("verified_at", "desc")
      .orderBy("source_verification_id", "desc")
      .execute();
    const latestVerificationBySource = new Map<string, (typeof verificationRows)[number]>();
    for (const verification of verificationRows) {
      if (!latestVerificationBySource.has(verification.source_id)) {
        latestVerificationBySource.set(verification.source_id, verification);
      }
    }
    const verifiedSources = [...latestVerificationBySource.values()].flatMap((verification) =>
      verification.outcome === "verified" && verification.canonical_source_id !== null
        ? [
            {
              submittedSourceId: verification.source_id,
              canonicalSourceId: verification.canonical_source_id,
            },
          ]
        : [],
    );

    return {
      reviewCase: this.mapCase(reviewCaseRow),
      decisionId: decision.decision_id,
      selectedAssertionKeys: stringArray(decision.selected_assertion_keys),
      verifiedSources,
    };
  }

  public async recordRecommendation(
    bundle: ReviewRecommendationBundle,
    actorAccountId: string,
    reason: string,
    correlationId: string,
  ): Promise<ReviewRecommendationBundle | undefined> {
    return this.database.transaction(async (transaction) => {
      const reviewCase = await transaction
        .selectFrom("review_moderation.review_cases")
        .select(["state", "primary_assignee_id", "version"])
        .where("review_case_id", "=", bundle.reviewCase.reviewCaseId)
        .forUpdate()
        .executeTakeFirst();
      if (reviewCase === undefined || reviewCase.primary_assignee_id !== actorAccountId) return undefined;
      if (reviewCase.state === "incorporation_recommended") return bundle;
      if (reviewCase.state !== "decision_ready") return undefined;

      await transaction
        .insertInto("review_moderation.curation_recommendations")
        .values(
          bundle.selectedAssertionKeys.map((assertionKey) => ({
            review_case_id: bundle.reviewCase.reviewCaseId,
            decision_id: bundle.decisionId,
            assertion_key: assertionKey,
            recommended_by_account_id: actorAccountId,
            reason,
          })),
        )
        .onConflict((conflict) =>
          conflict.columns(["review_case_id", "decision_id", "assertion_key"]).doNothing(),
        )
        .execute();

      await transaction
        .updateTable("review_moderation.review_cases")
        .set({ state: "incorporation_recommended", version: sql`version + 1` })
        .where("review_case_id", "=", bundle.reviewCase.reviewCaseId)
        .executeTakeFirstOrThrow();

      await this.outbox.append(transaction, {
        eventType: "review.incorporation-recommended",
        sourceContext: "review",
        aggregateType: "review_case",
        aggregateId: bundle.reviewCase.reviewCaseId,
        aggregateVersion: reviewCase.version + 1,
        idempotencyKey: `review-incorporation:${bundle.reviewCase.reviewCaseId}:${bundle.decisionId}`,
        correlationId,
        occurredAt: new Date(),
        payload: {
          reviewCaseId: bundle.reviewCase.reviewCaseId,
          decisionId: bundle.decisionId,
          submissionId: bundle.reviewCase.submissionId,
          revisionNumber: bundle.reviewCase.revisionNumber,
          selectedAssertionKeys: bundle.selectedAssertionKeys,
          verifiedSources: bundle.verifiedSources.map((source) => ({
            submittedSourceId: source.submittedSourceId,
            canonicalSourceId: source.canonicalSourceId,
          })),
        },
      });
      return bundle;
    });
  }

  private mapCase(row: {
    review_case_id: string;
    submission_id: string;
    active_revision_number: number;
    state: string;
    version: number;
    primary_assignee_id: string | null;
  }): ReviewCase {
    return {
      reviewCaseId: row.review_case_id,
      submissionId: row.submission_id,
      revisionNumber: row.active_revision_number,
      state: row.state,
      version: row.version,
      ...(row.primary_assignee_id === null ? {} : { primaryAssigneeId: row.primary_assignee_id }),
    };
  }
}
