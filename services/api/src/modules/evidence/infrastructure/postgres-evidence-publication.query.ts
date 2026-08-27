import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type {
  EvidencePublicationPort,
  EvidencePublicationSource,
} from "../application/evidence-publication.application.js";
import type { EvidenceAccessState } from "../application/evidence.application.js";

export class PostgresEvidencePublicationQuery implements EvidencePublicationPort {
  public async snapshot(transaction: DatabaseTransaction): Promise<EvidencePublicationSource[]> {
    const rows = await transaction
      .selectFrom("evidence.sources")
      .select([
        "source_id",
        "publisher",
        "title",
        "url",
        "published_on",
        "last_verified_on",
        "language_tag",
        "access_state",
        "evidence_tier",
        "public_summary",
        "content_sha256",
        "updated_at",
      ])
      .where("access_state", "!=", "restricted")
      .orderBy("source_id")
      .execute();

    return rows.map((row) => {
      const publicSource = {
        sourceId: row.source_id,
        publisher: row.publisher,
        title: row.title,
        url: row.url,
        ...(row.published_on === null ? {} : { publishedOn: row.published_on }),
        lastVerifiedOn: row.last_verified_on,
        languageTag: row.language_tag,
        accessState: row.access_state as EvidenceAccessState,
        ...(row.evidence_tier === null ? {} : { evidenceTier: row.evidence_tier }),
        ...(row.public_summary === null ? {} : { publicSummary: row.public_summary }),
      };
      return {
        ...publicSource,
        sourceRevision: row.updated_at.toISOString(),
        sourceVersion: row.last_verified_on,
        sourceSha256: sha256Content({ ...publicSource, contentSha256: row.content_sha256 }),
      };
    });
  }
}
