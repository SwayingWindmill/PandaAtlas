import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { JsonValue, PandaFactParticipant, ReviewedPandaFactInput } from "../application/panda.application.js";
import { recordFactAssertion, setCurrentFactConclusion } from "./panda-fact-writes.js";

export class PostgresPandaFactParticipant implements PandaFactParticipant {
  // The reviewed fact supersedes the field's current conclusion: its value joins the new conclusion's
  // superseded values, and the old conclusion version stays as history.
  public async applyReviewedFact(transaction: DatabaseTransaction, input: ReviewedPandaFactInput): Promise<void> {
    const current = await transaction
      .selectFrom("panda.fact_conclusions")
      .select(["value_json", "superseded_values_json"])
      .where("panda_id", "=", input.pandaId)
      .where("field_key", "=", input.fieldKey)
      .where("is_current", "=", true)
      .forUpdate()
      .executeTakeFirst();
    const supersededValues: JsonValue[] = current === undefined
      ? []
      : [
          ...(current.value_json === null ? [] : [current.value_json as JsonValue]),
          ...(Array.isArray(current.superseded_values_json) ? (current.superseded_values_json as JsonValue[]) : []),
        ];

    await recordFactAssertion(transaction, {
      assertionId: input.assertionId,
      pandaId: input.pandaId,
      fieldKey: input.fieldKey,
      value: input.value,
      certainty: input.certainty,
      lastVerifiedOn: input.lastVerifiedOn,
      sourceIds: [...new Set(input.sourceIds)],
    });
    await setCurrentFactConclusion(transaction, {
      pandaId: input.pandaId,
      fieldKey: input.fieldKey,
      value: input.value,
      status: input.certainty,
      lastVerifiedOn: input.lastVerifiedOn,
      supersededValues,
      assertionIds: [input.assertionId],
    });
  }
}
