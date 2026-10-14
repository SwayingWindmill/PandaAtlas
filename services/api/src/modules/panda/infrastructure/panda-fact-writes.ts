import { sql, type Selectable } from "kysely";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { PandaFactConclusions } from "../../../platform/database/database.panda.generated.js";
import type { RecordFactAssertionInput, SetFactConclusionInput } from "../application/panda.application.js";

export async function recordFactAssertion(
  transaction: DatabaseTransaction,
  input: RecordFactAssertionInput,
): Promise<void> {
  await transaction.insertInto("panda.fact_assertions").values({
    assertion_id: input.assertionId,
    panda_id: input.pandaId,
    field_key: input.fieldKey,
    value_json: sql`${JSON.stringify(input.value)}::jsonb`,
    certainty: input.certainty,
    last_verified_on: input.lastVerifiedOn,
    supersedes_assertion_id: input.supersedesAssertionId,
  }).execute();
  if (input.supersedesAssertionId !== undefined) {
    await transaction
      .updateTable("panda.fact_assertions")
      .set({ lifecycle_state: "superseded" })
      .where("assertion_id", "=", input.supersedesAssertionId)
      .execute();
  }
  await transaction.insertInto("panda.fact_assertion_sources").values(
    input.sourceIds.map((sourceId) => ({
      assertion_id: input.assertionId,
      source_id: sourceId,
      stance: "supports",
    })),
  ).execute();
}

// The conclusion becomes the field's current one; the previous current conclusion stays as history.
export async function setCurrentFactConclusion(
  transaction: DatabaseTransaction,
  input: SetFactConclusionInput,
): Promise<Selectable<PandaFactConclusions>> {
  await transaction
    .updateTable("panda.fact_conclusions")
    .set({ is_current: false })
    .where("panda_id", "=", input.pandaId)
    .where("field_key", "=", input.fieldKey)
    .where("is_current", "=", true)
    .execute();
  const latest = await transaction
    .selectFrom("panda.fact_conclusions")
    .select(({ fn }) => fn.max<number>("conclusion_version").as("version"))
    .where("panda_id", "=", input.pandaId)
    .where("field_key", "=", input.fieldKey)
    .executeTakeFirst();
  const conclusion = await transaction
    .insertInto("panda.fact_conclusions")
    .values({
      panda_id: input.pandaId,
      field_key: input.fieldKey,
      value_json: input.value === undefined ? null : sql`${JSON.stringify(input.value)}::jsonb`,
      status: input.status,
      last_verified_on: input.lastVerifiedOn,
      candidate_values_json: sql`${JSON.stringify(input.candidateValues ?? [])}::jsonb`,
      superseded_values_json: sql`${JSON.stringify(input.supersededValues ?? [])}::jsonb`,
      conclusion_version: (latest?.version ?? 0) + 1,
      is_current: true,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  await transaction.insertInto("panda.fact_conclusion_assertions").values(
    input.assertionIds.map((assertionId) => ({
      conclusion_id: conclusion.conclusion_id,
      assertion_id: assertionId,
    })),
  ).execute();
  return conclusion;
}
