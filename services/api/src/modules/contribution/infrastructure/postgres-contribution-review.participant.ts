import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type {
  ContributionReviewOutcomeInput,
  ContributionReviewParticipant,
} from "../application/contribution.application.js";

export class PostgresContributionReviewParticipant implements ContributionReviewParticipant {
  public async recordReviewOutcome(
    transaction: DatabaseTransaction,
    input: ContributionReviewOutcomeInput,
  ): Promise<void> {
    const status = await transaction
      .insertInto("community_intake.contributor_status_events")
      .values({
        submission_id: input.submissionId,
        status: input.status,
        active_revision_number: input.revisionNumber,
        user_visible_reason: input.explanation,
        source_context: "review",
        source_event_id: input.decisionId,
        actor_subject_hash: createHash("sha256").update(input.actorAccountId).digest("hex"),
        correlation_id: input.correlationId,
        idempotency_key: `v2-review-decision:${input.decisionId}`,
      })
      .returning(["status_event_id", "occurred_at"])
      .executeTakeFirstOrThrow();
    await transaction
      .updateTable("community_intake.submissions")
      .set({
        contributor_status: input.status,
        contributor_status_updated_at: status.occurred_at,
        current_status_event_id: status.status_event_id,
        updated_at: status.occurred_at,
      })
      .where("submission_id", "=", input.submissionId)
      .executeTakeFirstOrThrow();
  }
}
