import { sql } from "kysely";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { CuratedPandaFactInput, PandaCurationParticipant } from "../application/panda.application.js";

export class PostgresPandaCurationParticipant implements PandaCurationParticipant {
  // A curated fact becomes the field's first conclusion; replacing a current conclusion is not supported.
  public async applyCuratedFact(transaction: DatabaseTransaction, input: CuratedPandaFactInput): Promise<string> {
    const current = await transaction
      .selectFrom("panda.fact_conclusions")
      .select("conclusion_id")
      .where("panda_id", "=", input.pandaId)
      .where("field_key", "=", input.fieldKey)
      .where("is_current", "=", true)
      .executeTakeFirst();
    if (current !== undefined) {
      throw new Error(`Fact proposal requires no current Panda conclusion for ${input.fieldKey}`);
    }

    await transaction.insertInto("panda.fact_assertions").values({
      assertion_id: input.assertionId,
      panda_id: input.pandaId,
      field_key: input.fieldKey,
      value_json: sql`${JSON.stringify(input.value)}::jsonb`,
      certainty: input.certainty,
      last_verified_on: input.lastVerifiedOn,
    }).execute();
    await transaction.insertInto("panda.fact_assertion_sources").values(
      [...new Set(input.sourceIds)].map((sourceId) => ({
        assertion_id: input.assertionId,
        source_id: sourceId,
        stance: "supports",
      })),
    ).execute();
    await this.addConclusion(transaction, input);
    return input.assertionId;
  }

  private async addConclusion(transaction: DatabaseTransaction, input: CuratedPandaFactInput): Promise<void> {
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
        value_json: sql`${JSON.stringify(input.value)}::jsonb`,
        status: input.certainty,
        last_verified_on: input.lastVerifiedOn,
        candidate_values_json: sql`'[]'::jsonb`,
        superseded_values_json: sql`'[]'::jsonb`,
        conclusion_version: (latest?.version ?? 0) + 1,
        is_current: true,
      })
      .returning("conclusion_id")
      .executeTakeFirstOrThrow();
    await transaction.insertInto("panda.fact_conclusion_assertions").values({
      conclusion_id: conclusion.conclusion_id,
      assertion_id: input.assertionId,
    }).execute();
  }
}
