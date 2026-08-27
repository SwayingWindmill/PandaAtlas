import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type {
  LineagePublicationPort,
  LineagePublicationSource,
} from "../application/lineage-publication.application.js";
import type { ParentRole } from "../application/lineage.application.js";

export class PostgresLineagePublicationQuery implements LineagePublicationPort {
  public async snapshot(transaction: DatabaseTransaction): Promise<LineagePublicationSource[]> {
    const assertions = await transaction
      .selectFrom("lineage.parentage_assertions")
      .select(["assertion_id", "child_id", "parent_id", "parent_role", "reviewed_at", "updated_at"])
      .where("status", "=", "confirmed")
      .orderBy("assertion_id")
      .execute();
    const sourceRows = await transaction
      .selectFrom("lineage.parentage_assertion_sources")
      .select(["assertion_id", "source_id"])
      .orderBy("assertion_id")
      .orderBy("source_id")
      .execute();
    const sourcesByAssertion = new Map<string, string[]>();
    for (const row of sourceRows) {
      const current = sourcesByAssertion.get(row.assertion_id) ?? [];
      current.push(row.source_id);
      sourcesByAssertion.set(row.assertion_id, current);
    }

    return assertions.map((row) => {
      const projection = {
        assertionId: row.assertion_id,
        childId: row.child_id,
        parentId: row.parent_id,
        parentRole: row.parent_role as ParentRole,
        sourceIds: sourcesByAssertion.get(row.assertion_id) ?? [],
      };
      const revision = row.updated_at.toISOString();
      return {
        ...projection,
        sourceRevision: revision,
        sourceVersion: row.reviewed_at?.toISOString() ?? revision,
        sourceSha256: sha256Content(projection),
      };
    });
  }
}
