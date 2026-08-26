import { sql, type Selectable } from "kysely";
import type {
  DatabaseService,
  DatabaseTransaction,
} from "../../../platform/database/database.service.js";
import type { PandaFactConclusions } from "../../../platform/database/database.panda.generated.js";
import type {
  AddExternalIdentifierInput,
  AddPandaNameInput,
  CreatePandaInput,
  CuratedPandaFactInput,
  FactConclusionStatus,
  JsonValue,
  PandaCurationParticipant,
  PandaExternalIdentifier,
  PandaFactConclusion,
  PandaName,
  PandaNameKind,
  PandaRecord,
  PandaRepository,
  RecordFactAssertionInput,
  SetFactConclusionInput,
} from "../application/panda.application.js";
import { normalizeIdentityTerm } from "../application/panda.application.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function dateOnly(value: string): string {
  return value;
}

function jsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

function jsonArray(value: unknown): JsonValue[] {
  return Array.isArray(value) ? value.map((item) => jsonValue(item)) : [];
}

export class PostgresPandaRepository implements PandaRepository, PandaCurationParticipant {
  public constructor(private readonly database: DatabaseService) {}

  public async createPanda(input: CreatePandaInput): Promise<PandaRecord> {
    const nameKind = input.primaryName.nameKind ?? "official";
    const pandaId = await this.database.transaction(async (transaction) => {
      const inserted = await sql<{ panda_id: string }>`
        insert into panda.pandas default values returning panda_id
      `.execute(transaction);
      const pandaId = inserted.rows[0]?.panda_id;
      if (pandaId === undefined) {
        throw new Error("Panda insert did not return an identity");
      }
      await transaction.insertInto("panda.slugs").values({
        panda_id: pandaId,
        slug: input.canonicalSlug,
        slug_kind: "canonical",
      }).execute();
      const name = await transaction.insertInto("panda.names").values({
        panda_id: pandaId,
        language_tag: input.primaryName.languageTag,
        name_kind: nameKind,
        value: input.primaryName.value,
        normalized_value: normalizeIdentityTerm(input.primaryName.value),
        is_primary: true,
      }).returning("name_id").executeTakeFirstOrThrow();
      await transaction.insertInto("panda.name_sources").values(
        [...new Set(input.primaryName.sourceIds)].map((sourceId) => ({
          name_id: name.name_id,
          source_id: sourceId,
        })),
      ).execute();
      return pandaId;
    });
    const created = await this.getPanda(pandaId);
    if (created === undefined) {
      throw new Error("Created panda could not be reloaded");
    }
    return created;
  }

  public async getPanda(idOrSlug: string): Promise<PandaRecord | undefined> {
    const pandaId = UUID_PATTERN.test(idOrSlug)
      ? idOrSlug
      : (
          await this.database.db
            .selectFrom("panda.slugs")
            .select("panda_id")
            .where("slug", "=", idOrSlug)
            .executeTakeFirst()
        )?.panda_id;
    if (pandaId === undefined || !(await this.exists(pandaId))) {
      return undefined;
    }

    const [slugs, names, nameSources, externalIdentifiers, externalIdentifierSources, conclusions] = await Promise.all([
      this.database.db.selectFrom("panda.slugs").selectAll().where("panda_id", "=", pandaId).execute(),
      this.database.db.selectFrom("panda.names").selectAll().where("panda_id", "=", pandaId).execute(),
      this.database.db
        .selectFrom("panda.name_sources as source")
        .innerJoin("panda.names as name", "name.name_id", "source.name_id")
        .select(["source.name_id", "source.source_id"])
        .where("name.panda_id", "=", pandaId)
        .execute(),
      this.database.db
        .selectFrom("panda.external_identifiers")
        .selectAll()
        .where("panda_id", "=", pandaId)
        .execute(),
      this.database.db
        .selectFrom("panda.external_identifier_sources as source")
        .innerJoin(
          "panda.external_identifiers as identifier",
          "identifier.external_identifier_id",
          "source.external_identifier_id",
        )
        .select(["source.external_identifier_id", "source.source_id"])
        .where("identifier.panda_id", "=", pandaId)
        .execute(),
      this.database.db
        .selectFrom("panda.fact_conclusions")
        .selectAll()
        .where("panda_id", "=", pandaId)
        .where("is_current", "=", true)
        .orderBy("field_key")
        .execute(),
    ]);
    const canonical = slugs.find((slug) => slug.slug_kind === "canonical");
    if (canonical === undefined) {
      throw new Error(`Panda ${pandaId} has no canonical slug`);
    }
    return {
      pandaId,
      canonicalSlug: canonical.slug,
      legacySlugs: slugs.filter((slug) => slug.slug_kind === "legacy").map((slug) => slug.slug),
      names: names.map((name) => ({
        languageTag: name.language_tag,
        nameKind: name.name_kind as PandaNameKind,
        value: name.value,
        isPrimary: name.is_primary,
        sourceIds: nameSources
          .filter((source) => source.name_id === name.name_id)
          .map((source) => source.source_id),
      })),
      externalIdentifiers: externalIdentifiers.map((identifier) => ({
        system: identifier.system,
        value: identifier.value,
        sourceIds: externalIdentifierSources
          .filter((source) => source.external_identifier_id === identifier.external_identifier_id)
          .map((source) => source.source_id),
      })),
      conclusions: conclusions.map((conclusion) => this.mapConclusion(conclusion)),
    };
  }

  public async exists(pandaId: string): Promise<boolean> {
    const row = await this.database.db
      .selectFrom("panda.pandas")
      .select("panda_id")
      .where("panda_id", "=", pandaId)
      .executeTakeFirst();
    return row !== undefined;
  }

  public async changeCanonicalSlug(pandaId: string, canonicalSlug: string, changedOn: string): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const current = await transaction
        .selectFrom("panda.slugs")
        .select(["slug_id", "slug"])
        .where("panda_id", "=", pandaId)
        .where("slug_kind", "=", "canonical")
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (current.slug === canonicalSlug) {
        return;
      }
      await transaction
        .updateTable("panda.slugs")
        .set({ slug_kind: "legacy", valid_to: changedOn })
        .where("slug_id", "=", current.slug_id)
        .execute();
      await transaction.insertInto("panda.slugs").values({
        panda_id: pandaId,
        slug: canonicalSlug,
        slug_kind: "canonical",
        valid_from: changedOn,
      }).execute();
    });
  }

  public async addName(input: AddPandaNameInput): Promise<PandaName> {
    const name = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.insertInto("panda.names").values({
        panda_id: input.pandaId,
        language_tag: input.languageTag,
        name_kind: input.nameKind,
        value: input.value,
        normalized_value: normalizeIdentityTerm(input.value),
        is_primary: input.isPrimary ?? false,
        valid_from: input.validFrom,
        valid_to: input.validTo,
      }).returning(["name_id", "language_tag", "name_kind", "value", "is_primary"]).executeTakeFirstOrThrow();
      await transaction.insertInto("panda.name_sources").values(
        [...new Set(input.sourceIds)].map((sourceId) => ({
          name_id: inserted.name_id,
          source_id: sourceId,
        })),
      ).execute();
      return inserted;
    });
    return {
      languageTag: name.language_tag,
      nameKind: name.name_kind as PandaNameKind,
      value: name.value,
      isPrimary: name.is_primary,
      sourceIds: [...new Set(input.sourceIds)],
    };
  }

  public async addExternalIdentifier(input: AddExternalIdentifierInput): Promise<PandaExternalIdentifier> {
    const identifier = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.insertInto("panda.external_identifiers").values({
        panda_id: input.pandaId,
        system: input.system,
        value: input.value,
        normalized_value: input.value.trim().toLocaleLowerCase("en"),
      }).returning(["external_identifier_id", "system", "value"]).executeTakeFirstOrThrow();
      await transaction.insertInto("panda.external_identifier_sources").values(
        [...new Set(input.sourceIds)].map((sourceId) => ({
          external_identifier_id: inserted.external_identifier_id,
          source_id: sourceId,
        })),
      ).execute();
      return inserted;
    });
    return {
      system: identifier.system,
      value: identifier.value,
      sourceIds: [...new Set(input.sourceIds)],
    };
  }

  public async recordFactAssertion(input: RecordFactAssertionInput): Promise<void> {
    await this.database.transaction((transaction) => this.recordFactAssertionIn(transaction, input));
  }

  public async setFactConclusion(input: SetFactConclusionInput): Promise<PandaFactConclusion> {
    const row = await this.database.transaction((transaction) => this.setFactConclusionIn(transaction, input));
    return this.mapConclusion(row);
  }

  public async applyCuratedFact(
    transaction: DatabaseTransaction,
    input: CuratedPandaFactInput,
  ): Promise<void> {
    await this.recordFactAssertionIn(transaction, input);
    await this.setFactConclusionIn(transaction, {
      pandaId: input.pandaId,
      fieldKey: input.fieldKey,
      value: input.value,
      status: input.certainty,
      lastVerifiedOn: input.lastVerifiedOn,
      assertionIds: [input.assertionId],
    });
  }

  private async recordFactAssertionIn(
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

  private async setFactConclusionIn(
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

  private mapConclusion(row: Selectable<PandaFactConclusions>): PandaFactConclusion {
    return {
      fieldKey: row.field_key,
      ...(row.value_json === null ? {} : { value: jsonValue(row.value_json) }),
      status: row.status as FactConclusionStatus,
      lastVerifiedOn: dateOnly(row.last_verified_on),
      candidateValues: jsonArray(row.candidate_values_json),
      supersededValues: jsonArray(row.superseded_values_json),
      conclusionVersion: row.conclusion_version,
    };
  }
}
