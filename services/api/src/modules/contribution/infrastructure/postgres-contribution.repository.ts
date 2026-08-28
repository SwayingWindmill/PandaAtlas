import { createHash, randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  ContributionAttachmentRecord,
  ContributionRecord,
  ContributionRepository,
  ContributionReviewAssertion,
  ContributionReviewSurface,
  ContributionSourceRecord,
  RegisterContributionAttachmentInput,
  SubmitContributionInput,
} from "../application/contribution.application.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertionsFromContent(value: unknown): ContributionReviewAssertion[] {
  if (typeof value !== "object" || value === null || !("assertions" in value)) return [];
  const assertions = (value as { assertions?: unknown }).assertions;
  return Array.isArray(assertions) ? (assertions as ContributionReviewAssertion[]) : [];
}

export class PostgresContributionRepository implements ContributionRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async submit(input: SubmitContributionInput): Promise<ContributionRecord> {
    const contributorHash = sha256(input.accountId);
    const sources = input.sources.map((source) => ({ source, sourceId: randomUUID() }));
    const sourceIdsByKey = new Map(sources.map(({ source, sourceId }) => [source.sourceKey, sourceId]));
    const assertions: ContributionReviewAssertion[] = input.assertions.map((assertion) => ({
      assertionKey: assertion.assertionKey,
      fieldKey: assertion.fieldKey,
      value: assertion.value,
      certainty: assertion.certainty,
      lastVerifiedOn: assertion.lastVerifiedOn,
      sourceIds: assertion.sourceKeys.map((sourceKey) => sourceIdsByKey.get(sourceKey)!),
    }));
    const content = { assertions };
    const contentJson = JSON.stringify(content);

    return this.database.transaction(async (transaction) => {
      const submittedAt = new Date();
      const submission = await transaction
        .insertInto("community_intake.submissions")
        .values({
          account_id: input.accountId,
          contributor_subject_hash: contributorHash,
          submission_type: input.submissionType,
          target_id: input.targetPandaId,
          public_version_seen: input.publicVersionSeen,
          state: "submitted",
          draft_content: sql`${contentJson}::jsonb`,
          latest_revision_number: 1,
          submitted_at: submittedAt,
          contributor_status: "submitted",
          contributor_status_updated_at: submittedAt,
        })
        .returning(["submission_id", "target_id", "submitted_at", "contributor_status"])
        .executeTakeFirstOrThrow();

      await transaction
        .insertInto("community_intake.submission_revisions")
        .values({
          submission_id: submission.submission_id,
          revision_number: 1,
          content: sql`${contentJson}::jsonb`,
          content_sha256: sha256(contentJson),
          public_version_seen: input.publicVersionSeen,
          submitted_at: submittedAt,
        })
        .execute();

      const sourceRows = sources.map(({ source, sourceId }) => ({
        source_id: sourceId,
        submission_id: submission.submission_id,
        revision_number: 1,
        source_kind: source.sourceKind,
        title: source.title,
        locator: source.locator,
        publisher: source.publisher ?? null,
        published_on: source.publishedOn ?? null,
        normalized_locator_hash: sha256(source.locator.trim().toLocaleLowerCase("en")),
      }));
      await transaction.insertInto("community_intake.submitted_sources").values(sourceRows).execute();

      const status = await transaction
        .insertInto("community_intake.contributor_status_events")
        .values({
          submission_id: submission.submission_id,
          status: "submitted",
          active_revision_number: 1,
          source_context: "contributor",
          actor_subject_hash: contributorHash,
          correlation_id: input.correlationId,
          idempotency_key: `v2-submit:${submission.submission_id}`,
        })
        .returning("status_event_id")
        .executeTakeFirstOrThrow();

      await transaction
        .updateTable("community_intake.submissions")
        .set({ current_status_event_id: status.status_event_id, updated_at: submittedAt })
        .where("submission_id", "=", submission.submission_id)
        .executeTakeFirstOrThrow();

      return {
        submissionId: submission.submission_id,
        submissionType: input.submissionType,
        targetPandaId: submission.target_id,
        publicVersionSeen: input.publicVersionSeen,
        revisionNumber: 1,
        status: submission.contributor_status,
        submittedAt: submission.submitted_at ?? submittedAt,
      };
    });
  }

  public async listOwn(accountId: string): Promise<ContributionRecord[]> {
    const rows = await this.database.db
      .selectFrom("community_intake.submissions")
      .select([
        "submission_id",
        "submission_type",
        "target_id",
        "public_version_seen",
        "latest_revision_number",
        "contributor_status",
        "submitted_at",
      ])
      .where("account_id", "=", accountId)
      .where("submitted_at", "is not", null)
      .where("latest_revision_number", ">", 0)
      .orderBy("submitted_at", "desc")
      .limit(100)
      .execute();
    return rows.map((row) => ({
      submissionId: row.submission_id,
      submissionType: row.submission_type as ContributionRecord["submissionType"],
      targetPandaId: row.target_id,
      publicVersionSeen: row.public_version_seen,
      revisionNumber: row.latest_revision_number,
      status: row.contributor_status,
      submittedAt: row.submitted_at!,
    }));
  }

  public async getOwn(accountId: string, submissionId: string): Promise<ContributionRecord | undefined> {
    const row = await this.database.db
      .selectFrom("community_intake.submissions")
      .select([
        "submission_id",
        "submission_type",
        "target_id",
        "public_version_seen",
        "latest_revision_number",
        "contributor_status",
        "submitted_at",
      ])
      .where("submission_id", "=", submissionId)
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    if (row === undefined || row.submitted_at === null || row.latest_revision_number === 0) return undefined;
    return {
      submissionId: row.submission_id,
      submissionType: row.submission_type as ContributionRecord["submissionType"],
      targetPandaId: row.target_id,
      publicVersionSeen: row.public_version_seen,
      revisionNumber: row.latest_revision_number,
      status: row.contributor_status,
      submittedAt: row.submitted_at,
    };
  }

  public async getReviewSurface(submissionId: string): Promise<ContributionReviewSurface | undefined> {
    const submission = await this.database.db
      .selectFrom("community_intake.submissions")
      .select(["submission_id", "account_id", "target_id", "latest_revision_number", "public_version_seen", "state"])
      .where("submission_id", "=", submissionId)
      .executeTakeFirst();
    if (submission === undefined || submission.state !== "submitted" || submission.latest_revision_number === 0) {
      return undefined;
    }

    const revisionNumber = submission.latest_revision_number;
    const revision = await this.database.db
      .selectFrom("community_intake.submission_revisions")
      .select(["content", "public_version_seen"])
      .where("submission_id", "=", submissionId)
      .where("revision_number", "=", revisionNumber)
      .executeTakeFirstOrThrow();
    const sourceRows = await this.database.db
      .selectFrom("community_intake.submitted_sources")
      .select(["source_id", "source_kind", "title", "locator", "publisher", "published_on"])
      .where("submission_id", "=", submissionId)
      .where("revision_number", "=", revisionNumber)
      .orderBy("created_at")
      .execute();
    const attachmentRows = await this.database.db
      .selectFrom("community_intake.attachments")
      .select(["attachment_id", "media_type", "byte_size", "state"])
      .where("submission_id", "=", submissionId)
      .where("bound_revision_number", "=", revisionNumber)
      .where("state", "!=", "deleted")
      .orderBy("created_at")
      .execute();

    const sources: ContributionSourceRecord[] = sourceRows.map((source) => ({
      sourceId: source.source_id,
      sourceKind: source.source_kind,
      title: source.title,
      locator: source.locator,
      ...(source.publisher === null ? {} : { publisher: source.publisher }),
      ...(source.published_on === null ? {} : { publishedOn: source.published_on }),
    }));
    const attachments: ContributionAttachmentRecord[] = attachmentRows.map((attachment) => ({
      attachmentId: attachment.attachment_id,
      mediaType: attachment.media_type,
      byteSize: Number(attachment.byte_size),
      state: attachment.state,
    }));

    return {
      submissionId: submission.submission_id,
      ...(submission.account_id === null ? {} : { contributorAccountId: submission.account_id }),
      targetPandaId: submission.target_id,
      revisionNumber,
      publicVersionSeen: revision.public_version_seen,
      assertions: assertionsFromContent(revision.content),
      sources,
      attachments,
    };
  }

  public async registerAttachment(
    input: RegisterContributionAttachmentInput,
  ): Promise<ContributionAttachmentRecord | undefined> {
    const submission = await this.database.db
      .selectFrom("community_intake.submissions")
      .select(["account_id", "latest_revision_number"])
      .where("submission_id", "=", input.submissionId)
      .executeTakeFirst();
    if (
      submission === undefined ||
      submission.account_id !== input.accountId ||
      submission.latest_revision_number === 0
    ) {
      return undefined;
    }

    const row = await this.database.db
      .insertInto("community_intake.attachments")
      .values({
        submission_id: input.submissionId,
        bound_revision_number: submission.latest_revision_number,
        storage_bucket: "community-intake-private",
        storage_object_key: input.storageObjectKey,
        object_version: input.objectVersion,
        original_filename: input.originalFilename,
        media_type: input.mediaType,
        byte_size: input.byteSize,
        content_sha256: input.contentSha256,
        upload_completed_at: new Date(),
      })
      .returning(["attachment_id", "media_type", "byte_size", "state"])
      .executeTakeFirstOrThrow();
    return {
      attachmentId: row.attachment_id,
      mediaType: row.media_type,
      byteSize: Number(row.byte_size),
      state: row.state,
    };
  }
}
