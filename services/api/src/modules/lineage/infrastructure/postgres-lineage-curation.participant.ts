import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type {
  LineageCurationParticipant,
  ParentageAssertion,
} from "../application/lineage.application.js";

export class PostgresLineageCurationParticipant implements LineageCurationParticipant {
  public async applyCuratedParentage(
    transaction: DatabaseTransaction,
    input: ParentageAssertion,
  ): Promise<string> {
    if (input.childId === input.parentId) {
      throw new Error("A panda cannot be its own parent");
    }
    if (input.sourceIds.length === 0) {
      throw new Error("Parentage assertions require at least one evidence source");
    }
    const pandas = await transaction
      .selectFrom("panda.pandas")
      .select("panda_id")
      .where("panda_id", "in", [input.childId, input.parentId])
      .execute();
    if (new Set(pandas.map((panda) => panda.panda_id)).size !== 2) {
      throw new Error("Curated parentage references an unknown Panda");
    }

    await transaction.insertInto("lineage.parentage_assertions").values({
      assertion_id: input.assertionId,
      child_id: input.childId,
      parent_id: input.parentId,
      parent_role: input.parentRole,
      status: input.status,
      reviewed_at: input.reviewedAt,
    }).execute();
    await transaction.insertInto("lineage.parentage_assertion_sources").values(
      [...new Set(input.sourceIds)].map((sourceId) => ({
        assertion_id: input.assertionId,
        source_id: sourceId,
      })),
    ).execute();
    return input.assertionId;
  }
}
