import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import { deidentifiedSubjectHash } from "../application/contribution-erasure.js";
import type { ContributionPrivacyPort } from "../application/contribution-privacy.port.js";

const ERASED_FILENAME = "[deleted]";

export class PostgresContributionPrivacyQuery implements ContributionPrivacyPort {
  public async erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void> {
    const submissions = await transaction
      .selectFrom("community_intake.submissions")
      .select(["submission_id", "contributor_subject_hash"])
      .where("account_id", "=", accountId)
      .execute();

    for (const submission of submissions) {
      const tombstone = deidentifiedSubjectHash(submission.submission_id);
      const now = new Date();
      await transaction
        .updateTable("community_intake.contributor_status_events")
        .set({ actor_subject_hash: tombstone })
        .where("submission_id", "=", submission.submission_id)
        .where("actor_subject_hash", "=", submission.contributor_subject_hash)
        .execute();
      await transaction
        .updateTable("community_intake.attachments")
        .set({
          original_filename: ERASED_FILENAME,
          state: "deleted",
          body_deleted_at: now,
          updated_at: now,
        })
        .where("submission_id", "=", submission.submission_id)
        .where("original_filename", "!=", ERASED_FILENAME)
        .execute();
      await transaction
        .updateTable("community_intake.submissions")
        .set({
          account_id: null,
          contributor_subject_hash: tombstone,
          anonymized_at: now,
          updated_at: now,
        })
        .where("submission_id", "=", submission.submission_id)
        .executeTakeFirstOrThrow();
    }
  }
}
