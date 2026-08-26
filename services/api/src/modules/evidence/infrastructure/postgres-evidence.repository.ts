import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  CreateEvidenceAttachmentInput,
  CreateEvidenceSourceInput,
  EvidenceAccessState,
  EvidenceAttachment,
  EvidenceRepository,
  EvidenceSource,
  UpdateEvidenceVerificationInput,
} from "../application/evidence.application.js";

function dateOnly(value: string | null): string | undefined {
  return value === null ? undefined : value;
}

export class PostgresEvidenceRepository implements EvidenceRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async createSource(input: CreateEvidenceSourceInput): Promise<EvidenceSource> {
    const row = await this.database.db
      .insertInto("evidence.sources")
      .values({
        source_id: input.sourceId,
        publisher: input.publisher,
        title: input.title,
        url: input.url,
        published_on: input.publishedOn,
        last_verified_on: input.lastVerifiedOn,
        language_tag: input.languageTag,
        access_state: input.accessState,
        evidence_tier: input.evidenceTier,
        public_summary: input.publicSummary,
        internal_notes: input.internalNotes,
        content_sha256: input.contentSha256,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.mapSource(row);
  }

  public async getSource(sourceId: string): Promise<EvidenceSource | undefined> {
    const row = await this.database.db
      .selectFrom("evidence.sources")
      .selectAll()
      .where("source_id", "=", sourceId)
      .executeTakeFirst();
    return row === undefined ? undefined : this.mapSource(row);
  }

  public async updateVerification(input: UpdateEvidenceVerificationInput): Promise<EvidenceSource> {
    const row = await this.database.db
      .updateTable("evidence.sources")
      .set({
        last_verified_on: input.lastVerifiedOn,
        access_state: input.accessState,
        public_summary: input.publicSummary,
        internal_notes: input.internalNotes,
        content_sha256: input.contentSha256,
        updated_at: new Date(),
      })
      .where("source_id", "=", input.sourceId)
      .returningAll()
      .executeTakeFirstOrThrow();
    return this.mapSource(row);
  }

  public async addAttachment(input: CreateEvidenceAttachmentInput): Promise<EvidenceAttachment> {
    const row = await this.database.db
      .insertInto("evidence.attachments")
      .values({
        source_id: input.sourceId,
        storage_bucket: input.storageBucket,
        storage_key: input.storageKey,
        object_version: input.objectVersion,
        content_sha256: input.contentSha256,
        byte_size: input.byteSize,
        media_type: input.mediaType,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return {
      attachmentId: row.attachment_id,
      sourceId: row.source_id,
      storageBucket: row.storage_bucket,
      storageKey: row.storage_key,
      objectVersion: row.object_version,
      contentSha256: row.content_sha256,
      byteSize: Number(row.byte_size),
      mediaType: row.media_type,
    };
  }

  private mapSource(row: {
    source_id: string;
    publisher: string;
    title: string;
    url: string;
    published_on: string | null;
    last_verified_on: string;
    language_tag: string;
    access_state: string;
    evidence_tier: string | null;
    public_summary: string | null;
    internal_notes: string | null;
    content_sha256: string | null;
  }): EvidenceSource {
    return {
      sourceId: row.source_id,
      publisher: row.publisher,
      title: row.title,
      url: row.url,
      ...(dateOnly(row.published_on) === undefined ? {} : { publishedOn: dateOnly(row.published_on) }),
      lastVerifiedOn: row.last_verified_on,
      languageTag: row.language_tag,
      accessState: row.access_state as EvidenceAccessState,
      ...(row.evidence_tier === null ? {} : { evidenceTier: row.evidence_tier }),
      ...(row.public_summary === null ? {} : { publicSummary: row.public_summary }),
      ...(row.internal_notes === null ? {} : { internalNotes: row.internal_notes }),
      ...(row.content_sha256 === null ? {} : { contentSha256: row.content_sha256 }),
    };
  }
}
