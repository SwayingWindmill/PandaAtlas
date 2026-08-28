import { isDeepStrictEqual } from "node:util";
import { sql, type Selectable } from "kysely";
import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { PandaFactConclusions } from "../../../platform/database/database.panda.generated.js";
import {
  normalizeIdentityTerm,
  type AddExternalIdentifierInput,
  type AddPandaNameInput,
  type CuratedFactMode,
  type CuratedIdentityMode,
  type CuratedPandaFactInput,
  type FactConclusionStatus,
  type JsonValue,
  type PandaCurationParticipant,
} from "../application/panda.application.js";

interface CurrentConclusion {
  row: Selectable<PandaFactConclusions>;
  assertionIds: string[];
}

function jsonValues(value: unknown): JsonValue[] {
  return Array.isArray(value) ? (value as JsonValue[]) : [];
}

function distinctJson(values: JsonValue[]): JsonValue[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function latestDate(left: string, right: string): string {
  return left >= right ? left : right;
}

export class PostgresPandaCurationParticipant implements PandaCurationParticipant {
  public async applyCuratedFact(
    transaction: DatabaseTransaction,
    input: CuratedPandaFactInput,
    mode: CuratedFactMode = "propose",
  ): Promise<string> {
    const current = await this.currentConclusion(transaction, input.pandaId, input.fieldKey);
    if (mode === "propose" && current !== undefined) {
      throw new Error(`Fact proposal requires no current Panda conclusion for ${input.fieldKey}`);
    }
    if (mode !== "propose" && current === undefined) {
      throw new Error(`${mode} requires an existing Panda fact conclusion for ${input.fieldKey}`);
    }
    if (mode === "corroborate") {
      const corroborated = current as CurrentConclusion;
      if (
        corroborated.row.value_json === null ||
        !isDeepStrictEqual(corroborated.row.value_json, input.value)
      ) {
        throw new Error(`Corroboration must preserve the current Panda fact value for ${input.fieldKey}`);
      }
    }
    if (mode === "refine") {
      const refined = current as CurrentConclusion;
      if (refined.row.value_json === null) {
        throw new Error(`Fact refinement requires a selected current value for ${input.fieldKey}`);
      }
      if (isDeepStrictEqual(refined.row.value_json, input.value)) {
        throw new Error(`Fact refinement must change the current Panda fact value for ${input.fieldKey}`);
      }
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

    if (mode === "propose") {
      await this.replaceConclusion(transaction, {
        pandaId: input.pandaId,
        fieldKey: input.fieldKey,
        value: input.value,
        status: input.certainty,
        lastVerifiedOn: input.lastVerifiedOn,
        assertionIds: [input.assertionId],
      });
      return input.assertionId;
    }

    const existing = current as CurrentConclusion;
    if (mode === "corroborate") {
      await this.replaceConclusion(transaction, {
        pandaId: input.pandaId,
        fieldKey: input.fieldKey,
        value: existing.row.value_json as JsonValue,
        status: existing.row.status as FactConclusionStatus,
        lastVerifiedOn: latestDate(existing.row.last_verified_on, input.lastVerifiedOn),
        candidateValues: jsonValues(existing.row.candidate_values_json),
        supersededValues: jsonValues(existing.row.superseded_values_json),
        assertionIds: [...existing.assertionIds, input.assertionId],
      });
      return input.assertionId;
    }
    if (mode === "refine") {
      await this.replaceConclusion(transaction, {
        pandaId: input.pandaId,
        fieldKey: input.fieldKey,
        value: input.value,
        status: input.certainty,
        lastVerifiedOn: latestDate(existing.row.last_verified_on, input.lastVerifiedOn),
        supersededValues: distinctJson([
          ...jsonValues(existing.row.superseded_values_json),
          existing.row.value_json as JsonValue,
        ]),
        assertionIds: [input.assertionId],
      });
      return input.assertionId;
    }

    const currentCandidates = jsonValues(existing.row.candidate_values_json);
    const disputedValues = distinctJson([
      ...currentCandidates,
      ...(existing.row.value_json === null ? [] : [existing.row.value_json as JsonValue]),
      input.value,
    ]);
    await this.replaceConclusion(transaction, {
      pandaId: input.pandaId,
      fieldKey: input.fieldKey,
      status: "disputed",
      lastVerifiedOn: latestDate(existing.row.last_verified_on, input.lastVerifiedOn),
      candidateValues: disputedValues,
      supersededValues: jsonValues(existing.row.superseded_values_json),
      assertionIds: [...existing.assertionIds, input.assertionId],
    });
    return input.assertionId;
  }

  public async applyCuratedName(
    transaction: DatabaseTransaction,
    input: AddPandaNameInput,
    mode: CuratedIdentityMode,
  ): Promise<string> {
    const existing = await transaction
      .selectFrom("panda.names")
      .select("name_id")
      .where("panda_id", "=", input.pandaId)
      .where("language_tag", "=", input.languageTag)
      .where("name_kind", "=", input.nameKind)
      .where("value", "=", input.value)
      .executeTakeFirst();
    if (mode === "add" && existing !== undefined) {
      throw new Error("Panda name add requires a previously absent name");
    }
    if (mode === "corroborate" && existing === undefined) {
      throw new Error("Panda name corroboration requires an existing name");
    }

    const nameId = existing?.name_id ?? (
      await transaction
        .insertInto("panda.names")
        .values({
          panda_id: input.pandaId,
          language_tag: input.languageTag,
          name_kind: input.nameKind,
          value: input.value,
          normalized_value: normalizeIdentityTerm(input.value),
          is_primary: input.isPrimary ?? false,
          valid_from: input.validFrom,
          valid_to: input.validTo,
        })
        .returning("name_id")
        .executeTakeFirstOrThrow()
    ).name_id;

    await transaction
      .insertInto("panda.name_sources")
      .values([...new Set(input.sourceIds)].map((sourceId) => ({ name_id: nameId, source_id: sourceId })))
      .onConflict((conflict) => conflict.columns(["name_id", "source_id"]).doNothing())
      .execute();
    return nameId;
  }

  public async applyCuratedExternalIdentifier(
    transaction: DatabaseTransaction,
    input: AddExternalIdentifierInput,
    mode: CuratedIdentityMode,
  ): Promise<string> {
    const normalizedValue = input.value.trim().toLocaleLowerCase("en");
    const existing = await transaction
      .selectFrom("panda.external_identifiers")
      .select(["external_identifier_id", "panda_id"])
      .where("system", "=", input.system)
      .where("normalized_value", "=", normalizedValue)
      .executeTakeFirst();
    if (existing !== undefined && existing.panda_id !== input.pandaId) {
      throw new Error("External identifier is already assigned to a different Panda");
    }
    if (mode === "add" && existing !== undefined) {
      throw new Error("External identifier add requires a previously absent identifier");
    }
    if (mode === "corroborate" && existing === undefined) {
      throw new Error("External identifier corroboration requires an existing identifier");
    }

    const identifierId = existing?.external_identifier_id ?? (
      await transaction
        .insertInto("panda.external_identifiers")
        .values({
          panda_id: input.pandaId,
          system: input.system,
          value: input.value,
          normalized_value: normalizedValue,
        })
        .returning("external_identifier_id")
        .executeTakeFirstOrThrow()
    ).external_identifier_id;

    await transaction
      .insertInto("panda.external_identifier_sources")
      .values(
        [...new Set(input.sourceIds)].map((sourceId) => ({
          external_identifier_id: identifierId,
          source_id: sourceId,
        })),
      )
      .onConflict((conflict) => conflict.columns(["external_identifier_id", "source_id"]).doNothing())
      .execute();
    return identifierId;
  }

  private async currentConclusion(
    transaction: DatabaseTransaction,
    pandaId: string,
    fieldKey: string,
  ): Promise<CurrentConclusion | undefined> {
    const row = await transaction
      .selectFrom("panda.fact_conclusions")
      .selectAll()
      .where("panda_id", "=", pandaId)
      .where("field_key", "=", fieldKey)
      .where("is_current", "=", true)
      .executeTakeFirst();
    if (row === undefined) return undefined;
    const links = await transaction
      .selectFrom("panda.fact_conclusion_assertions")
      .select("assertion_id")
      .where("conclusion_id", "=", row.conclusion_id)
      .orderBy("assertion_id")
      .execute();
    return { row, assertionIds: links.map((link) => link.assertion_id) };
  }

  private async replaceConclusion(
    transaction: DatabaseTransaction,
    input: {
      pandaId: string;
      fieldKey: string;
      value?: JsonValue;
      status: FactConclusionStatus;
      lastVerifiedOn: string;
      candidateValues?: JsonValue[];
      supersededValues?: JsonValue[];
      assertionIds: string[];
    },
  ): Promise<void> {
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
      .returning("conclusion_id")
      .executeTakeFirstOrThrow();
    await transaction.insertInto("panda.fact_conclusion_assertions").values(
      [...new Set(input.assertionIds)].map((assertionId) => ({
        conclusion_id: conclusion.conclusion_id,
        assertion_id: assertionId,
      })),
    ).execute();
  }
}
