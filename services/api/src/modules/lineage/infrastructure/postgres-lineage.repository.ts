import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  LineageFamily,
  LineageRepository,
  ParentageAssertion,
  ParentageStatus,
  ParentRole,
} from "../application/lineage.application.js";

export class PostgresLineageRepository implements LineageRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async createAssertion(input: ParentageAssertion): Promise<ParentageAssertion> {
    await this.database.transaction(async (transaction) => {
      await transaction.insertInto("lineage.parentage_assertions").values({
        assertion_id: input.assertionId,
        child_id: input.childId,
        parent_id: input.parentId,
        parent_role: input.parentRole,
        status: input.status,
        reviewed_at: input.reviewedAt,
      }).execute();
      await transaction.insertInto("lineage.parentage_assertion_sources").values(
        input.sourceIds.map((sourceId) => ({ assertion_id: input.assertionId, source_id: sourceId })),
      ).execute();
    });
    return input;
  }

  public async setAssertionStatus(
    assertionId: string,
    status: ParentageStatus,
    reviewedAt?: string,
  ): Promise<void> {
    await this.database.db
      .updateTable("lineage.parentage_assertions")
      .set({ status, reviewed_at: reviewedAt ?? null, updated_at: new Date() })
      .where("assertion_id", "=", assertionId)
      .returning("assertion_id")
      .executeTakeFirstOrThrow();
  }

  public async getFamily(pandaId: string): Promise<LineageFamily> {
    const assertions = await this.database.db
      .selectFrom("lineage.parentage_assertions")
      .selectAll()
      .where((expression) =>
        expression.or([
          expression("child_id", "=", pandaId),
          expression("parent_id", "=", pandaId),
        ]),
      )
      .orderBy("created_at")
      .execute();
    const assertionIds = assertions.map((assertion) => assertion.assertion_id);
    const sources = assertionIds.length === 0
      ? []
      : await this.database.db
          .selectFrom("lineage.parentage_assertion_sources")
          .selectAll()
          .where("assertion_id", "in", assertionIds)
          .execute();

    const confirmedParents = await this.database.db
      .selectFrom("lineage.parentage_assertions")
      .select("parent_id")
      .where("child_id", "=", pandaId)
      .where("status", "=", "confirmed")
      .execute();
    const parentIds = [...new Set(confirmedParents.map((row) => row.parent_id))].sort();
    const confirmedChildren = await this.database.db
      .selectFrom("lineage.parentage_assertions")
      .select("child_id")
      .where("parent_id", "=", pandaId)
      .where("status", "=", "confirmed")
      .execute();
    const childIds = [...new Set(confirmedChildren.map((row) => row.child_id))].sort();
    const siblingRows = parentIds.length === 0
      ? []
      : await this.database.db
          .selectFrom("lineage.parentage_assertions")
          .select("child_id")
          .where("parent_id", "in", parentIds)
          .where("status", "=", "confirmed")
          .where("child_id", "!=", pandaId)
          .execute();

    return {
      assertions: assertions.map((row): ParentageAssertion => ({
        assertionId: row.assertion_id,
        childId: row.child_id,
        parentId: row.parent_id,
        parentRole: row.parent_role as ParentRole,
        status: row.status as ParentageStatus,
        ...(row.reviewed_at === null ? {} : { reviewedAt: row.reviewed_at.toISOString() }),
        sourceIds: sources
          .filter((source) => source.assertion_id === row.assertion_id)
          .map((source) => source.source_id),
      })),
      parentIds,
      childIds,
      siblingIds: [...new Set(siblingRows.map((row) => row.child_id))].sort(),
    };
  }
}
