import { sql } from "kysely";
import type { ReviewModerationReviewCaseState } from "../../../platform/database/database.review-moderation.generated.js";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { ContributionReviewParticipant } from "../../contribution/application/contribution.application.js";
import type { PandaFactParticipant } from "../../panda/application/panda.application.js";
import {
  REVIEW_CASE_STATES,
  type ReviewCase,
  type ReviewCaseListQuery,
  type ReviewCasePage,
  type ReviewCaseState,
  type ReviewDecisionRecord,
  type ReviewRepository,
  type ReviewSourceVerificationInput,
  type ReviewVerifiedSource,
} from "../application/review.application.js";

// The column's enum still lists states the review flow no longer uses; no row holds one.
function caseState(state: ReviewModerationReviewCaseState): ReviewCaseState {
  if (!(REVIEW_CASE_STATES as readonly string[]).includes(state)) {
    throw new Error(`Review case is in a retired state: ${state}`);
  }
  return state as ReviewCaseState;
}

export class PostgresReviewRepository implements ReviewRepository {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly pandas: PandaFactParticipant,
    private readonly contributions: ContributionReviewParticipant,
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

  public async listCases(query: ReviewCaseListQuery): Promise<ReviewCasePage> {
    let rowsQuery = this.database.db
      .selectFrom("review_moderation.review_case_queue")
      .selectAll()
      .where("review_case_id", "is not", null);
    let countQuery = this.database.db
      .selectFrom("review_moderation.review_case_queue")
      .select((expression) => expression.fn.countAll<string>().as("count"))
      .where("review_case_id", "is not", null);

    if (query.state !== undefined) {
      rowsQuery = rowsQuery.where("state", "=", query.state);
      countQuery = countQuery.where("state", "=", query.state);
    }

    const [rows, count] = await Promise.all([
      rowsQuery
        .orderBy("sla_overdue", "desc")
        .orderBy("created_at", "asc")
        .limit(query.limit)
        .offset(query.offset)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);

    return {
      items: rows.flatMap((row) => {
        if (
          row.review_case_id === null ||
          row.submission_id === null ||
          row.active_revision_number === null ||
          row.state === null ||
          row.version === null ||
          row.risk_level === null ||
          row.created_at === null ||
          row.updated_at === null ||
          row.first_response_due_at === null
        ) {
          return [];
        }
        return [{
          reviewCaseId: row.review_case_id,
          submissionId: row.submission_id,
          revisionNumber: row.active_revision_number,
          state: caseState(row.state),
          version: row.version,
          ...(row.primary_assignee_id === null ? {} : { primaryAssigneeId: row.primary_assignee_id }),
          riskLevel: row.risk_level,
          ...(row.target_id === null ? {} : { targetPandaId: row.target_id }),
          ...(row.contributor_status === null ? {} : { contributorStatus: row.contributor_status }),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          firstResponseDueAt: row.first_response_due_at,
          slaOverdue: row.sla_overdue ?? false,
          queueAgeSeconds: Number(row.queue_age_seconds ?? 0),
        }];
      }),
      total: Number(count.count),
      limit: query.limit,
      offset: query.offset,
    };
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
      .where("state", "in", ["new", "assigned"])
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

  public async listVerifiedSources(reviewCaseId: string, revisionNumber: number): Promise<ReviewVerifiedSource[]> {
    const rows = await this.database.db
      .selectFrom("review_moderation.source_verifications")
      .select(["source_id", "canonical_source_id", "outcome"])
      .where("review_case_id", "=", reviewCaseId)
      .where("active_revision_number", "=", revisionNumber)
      .orderBy("source_id")
      .orderBy("verified_at", "desc")
      .orderBy("source_verification_id", "desc")
      .execute();
    const latestBySource = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestBySource.has(row.source_id)) latestBySource.set(row.source_id, row);
    }
    return [...latestBySource.values()].flatMap((row) =>
      row.outcome === "verified" && row.canonical_source_id !== null
        ? [{ submittedSourceId: row.source_id, canonicalSourceId: row.canonical_source_id }]
        : [],
    );
  }

  public async recordDecision(record: ReviewDecisionRecord): Promise<string | undefined> {
    return this.database.transaction(async (transaction) => {
      const reviewCase = await transaction
        .selectFrom("review_moderation.review_cases")
        .select(["state", "primary_assignee_id", "version"])
        .where("review_case_id", "=", record.reviewCaseId)
        .forUpdate()
        .executeTakeFirst();
      if (
        reviewCase === undefined ||
        reviewCase.state !== "assigned" ||
        reviewCase.primary_assignee_id !== record.actorAccountId
      ) {
        return undefined;
      }

      const { decision_id: decisionId } = await transaction
        .insertInto("review_moderation.decisions")
        .values({
          review_case_id: record.reviewCaseId,
          active_revision_number: record.revisionNumber,
          outcome: record.decision.outcome,
          user_visible_explanation: record.decision.userVisibleExplanation,
          internal_reason: record.decision.internalReason ?? null,
          selected_assertion_keys: sql`${JSON.stringify(record.decision.selectedAssertionKeys)}::jsonb`,
          duplicate_of_review_case_id: record.decision.duplicateOfReviewCaseId ?? null,
          decided_by_account_id: record.actorAccountId,
        })
        .returning("decision_id")
        .executeTakeFirstOrThrow();

      for (const fact of record.acceptedFacts) {
        await this.pandas.applyReviewedFact(transaction, {
          assertionId: `review:${decisionId}:${fact.assertionKey}`,
          pandaId: record.targetPandaId,
          fieldKey: fact.fieldKey,
          value: fact.value,
          certainty: fact.certainty,
          lastVerifiedOn: fact.lastVerifiedOn,
          sourceIds: fact.sourceIds,
        });
      }

      await this.contributions.recordReviewOutcome(transaction, {
        submissionId: record.submissionId,
        revisionNumber: record.revisionNumber,
        status: record.contributorStatus,
        explanation: record.decision.userVisibleExplanation,
        decisionId,
        actorAccountId: record.actorAccountId,
        correlationId: record.correlationId,
      });

      await transaction
        .updateTable("review_moderation.review_cases")
        .set({ state: "closed", closed_at: new Date(), version: sql`version + 1` })
        .where("review_case_id", "=", record.reviewCaseId)
        .executeTakeFirstOrThrow();

      await this.outbox.append(transaction, {
        eventType: "review.decision.recorded",
        sourceContext: "review",
        aggregateType: "review_case",
        aggregateId: record.reviewCaseId,
        aggregateVersion: reviewCase.version + 1,
        idempotencyKey: `review-decision:${decisionId}`,
        correlationId: record.correlationId,
        occurredAt: new Date(),
        payload: {
          reviewCaseId: record.reviewCaseId,
          decisionId,
          submissionId: record.submissionId,
          revisionNumber: record.revisionNumber,
          outcome: record.decision.outcome,
          targetPandaId: record.targetPandaId,
          appliedFacts: record.acceptedFacts.map((fact) => ({
            assertionKey: fact.assertionKey,
            fieldKey: fact.fieldKey,
            sourceIds: fact.sourceIds,
          })),
        },
      });
      return decisionId;
    });
  }

  private mapCase(row: {
    review_case_id: string;
    submission_id: string;
    active_revision_number: number;
    state: ReviewModerationReviewCaseState;
    version: number;
    primary_assignee_id: string | null;
  }): ReviewCase {
    return {
      reviewCaseId: row.review_case_id,
      submissionId: row.submission_id,
      revisionNumber: row.active_revision_number,
      state: caseState(row.state),
      version: row.version,
      ...(row.primary_assignee_id === null ? {} : { primaryAssigneeId: row.primary_assignee_id }),
    };
  }
}
