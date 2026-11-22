import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { type Kysely, sql } from "kysely";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertVerifiedDatabase } from "./batch-database.js";
import { publishedComparisons } from "./modules/catalog/application/comparison-catalog.js";
import { publishedOverseasStatus } from "./modules/catalog/application/overseas-status-catalog.js";
import { publishedVenueNews } from "./modules/catalog/application/venue-news-catalog.js";
import type { JsonValue } from "./modules/panda/application/panda.application.js";
import {
  parsePandaEnrichment,
  type PandaEnrichmentDocument,
  type PandaEnrichmentFact,
  type PandaEnrichmentParent,
} from "./modules/panda/application/panda-enrichment.js";
import { recordFactAssertion, setCurrentFactConclusion } from "./modules/panda/infrastructure/panda-fact-writes.js";
import {
  assertFacilityVisitGuide,
  assertInstitutionProfile,
  type FacilityVisitGuide,
  type InstitutionProfile,
} from "./modules/places/application/visitor-content.js";
import { ConfigModule } from "./platform/config/config.module.js";
import { DatabaseModule } from "./platform/database/database.module.js";
import { DatabaseService } from "./platform/database/database.service.js";
import type { Database } from "./platform/database/database.types.js";

// Entry point of the curation.content batch adapter (contracts/batch-operations.v1.json):
//   BATCH_MANIFEST_PATH=data/curation/venue-news/venue-news.json node services/api/dist/content-command.js
// Content ships apart from code: CI validates each file on its pull request (scripts/curation/validate_*.py),
// and after merge the owner runs this batch on main to write the file into the database. The manifest path
// picks what is written; docs/runbooks/content-entry.md is the workflow.

const REPORT_DIRECTORY = ".batch-work/content";

type CatalogTable = "place.venue_news_catalog" | "place.overseas_status_catalog" | "place.comparison_catalog";

export type ContentKind = "venue-news" | "overseas-status" | "comparisons" | "institutions" | "panda-enrichment";

const KINDS: Record<string, ContentKind> = {
  "data/curation/venue-news/venue-news.json": "venue-news",
  "data/curation/overseas-status/overseas-status.json": "overseas-status",
  "data/curation/comparisons/comparisons.json": "comparisons",
  "data/curation/institutions/institutions.json": "institutions",
  "data/curation/panda-enrichment/top-pandas.json": "panda-enrichment",
};

export function contentKind(manifestPath: string): ContentKind {
  const kind = KINDS[manifestPath.replaceAll("\\", "/").replace(/^\.\//, "")];
  if (!kind) throw new Error(`curation.content writes ${Object.keys(KINDS).join(", ")}; not ${manifestPath}.`);
  return kind;
}

export interface ContentReport {
  kind: ContentKind;
  outcome: "written" | "already current";
  version?: string;
  previousVersion?: string;
  /** Published entries for a catalog; institutions and the places updated for institutions. */
  counts: Record<string, number>;
}

/** Upserts a one-row catalog. The same content is a no-op; changed content needs a new version. */
export async function writeCatalog(
  db: Kysely<Database>,
  table: CatalogTable,
  version: string,
  document: unknown,
): Promise<Pick<ContentReport, "outcome" | "previousVersion">> {
  const json = JSON.stringify(document);
  const current = await db
    .selectFrom(table)
    .select(["version", sql<boolean>`document = ${json}::jsonb`.as("same")])
    .where("catalog_id", "=", 1)
    .executeTakeFirst();
  if (current?.same === true) return { outcome: "already current" };
  if (current?.version === version)
    throw new Error(`${table} already holds ${version} with different content; give the file a new version.`);
  await db
    .insertInto(table)
    .values({ catalog_id: 1, version, document: json, updated_at: sql`now()` })
    .onConflict((conflict) => conflict.column("catalog_id").doUpdateSet({ version, document: json, updated_at: sql`now()` }))
    .execute();
  return { outcome: "written", ...(current === undefined ? {} : { previousVersion: current.version }) };
}

interface InstitutionPlace {
  slug: string;
  nameZh?: string | null;
  nameEn?: string | null;
  countryCode?: string | null;
  region?: string | null;
  longitude?: number;
  latitude?: number;
  visitGuide?: unknown;
  legacySlugs?: string[];
}

interface InstitutionEntry {
  slug: string;
  nameZh?: string | null;
  nameEn?: string | null;
  countryCode?: string | null;
  profile: unknown;
  places?: InstitutionPlace[];
}

function institutionsOf(file: unknown): InstitutionEntry[] {
  const institutions = (file as { institutions?: unknown } | null)?.institutions;
  if (!Array.isArray(institutions) || institutions.some((entry) => typeof (entry as { slug?: unknown })?.slug !== "string")) {
    throw new Error("institutions.json needs an institutions list of entries with a slug.");
  }
  const entries = institutions as InstitutionEntry[];
  for (const institution of entries) {
    assertInstitutionProfile(institution.profile as InstitutionProfile);
    for (const place of institution.places ?? []) {
      if (place.visitGuide !== undefined && place.visitGuide !== null) {
        assertFacilityVisitGuide(place.visitGuide as FacilityVisitGuide);
      }
    }
  }
  return entries;
}

function nonEmptyText(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

async function upsertFacilityPlace(
  trx: Kysely<Database>,
  institution: InstitutionEntry,
  institutionId: string,
  place: InstitutionPlace,
): Promise<number> {
  const existing = await trx
    .selectFrom("place.places")
    .select(["place_id", "place_type"])
    .where("slug", "=", place.slug)
    .executeTakeFirst();
  const hasPoint = typeof place.longitude === "number" && typeof place.latitude === "number";
  const centerValue = hasPoint
    ? sql<string>`ST_SetSRID(ST_MakePoint(${place.longitude}, ${place.latitude}), 4326)`
    : undefined;
  const visitGuide = place.visitGuide === undefined || place.visitGuide === null ? null : JSON.stringify(place.visitGuide);

  if (existing !== undefined) {
    if (existing.place_type !== "facility") return 0;
    const result = await trx
      .updateTable("place.places")
      .set({
        institution_id: institutionId,
        visit_guide: visitGuide,
        updated_at: sql`now()`,
        ...(centerValue === undefined ? {} : { center: centerValue }),
        ...(place.nameZh === undefined ? {} : { name_zh: place.nameZh }),
        ...(place.nameEn === undefined ? {} : { name_en: place.nameEn }),
        ...(place.countryCode === undefined ? {} : { country_code: place.countryCode }),
        ...(place.region === undefined ? {} : { region: place.region }),
      })
      .where("place_id", "=", existing.place_id)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  const nameZh = place.nameZh ?? (place.slug === institution.slug ? (institution.nameZh ?? null) : null);
  const nameEn = place.nameEn ?? (place.slug === institution.slug ? (institution.nameEn ?? null) : null);
  if (nonEmptyText(nameZh) === null && nonEmptyText(nameEn) === null) return 0;

  await trx
    .insertInto("place.places")
    .values({
      slug: place.slug,
      place_type: "facility",
      institution_id: institutionId,
      name_zh: nameZh,
      name_en: nameEn,
      country_code: place.countryCode ?? institution.countryCode ?? null,
      region: place.region ?? null,
      visit_guide: visitGuide,
      ...(centerValue === undefined ? {} : { center: centerValue }),
    })
    .execute();
  return 1;
}

/**
 * One transaction: upserts institutions by slug and facility places by slug (creating named
 * facilities when missing and leaving non-facility places untouched), then merges legacySlugs.
 */
export async function writeInstitutions(db: Kysely<Database>, institutions: readonly InstitutionEntry[]): Promise<Record<string, number>> {
  const inTransaction = <T>(work: (trx: Kysely<Database>) => Promise<T>) => (db.isTransaction ? work(db) : db.transaction().execute(work));
  return inTransaction(async (trx) => {
    let merged = 0;
    let places = 0;
    for (const institution of institutions) {
      const profile = JSON.stringify(institution.profile);
      const row = await trx
        .insertInto("place.institutions")
        .values({
          slug: institution.slug,
          name_zh: institution.nameZh ?? null,
          name_en: institution.nameEn ?? null,
          country_code: institution.countryCode ?? null,
          profile,
        })
        .onConflict((conflict) =>
          conflict.column("slug").doUpdateSet((eb) => ({
            name_zh: eb.ref("excluded.name_zh"),
            name_en: eb.ref("excluded.name_en"),
            country_code: eb.ref("excluded.country_code"),
            profile: eb.ref("excluded.profile"),
            updated_at: sql`now()`,
          })),
        )
        .returning("institution_id")
        .executeTakeFirstOrThrow();
      for (const place of institution.places ?? []) {
        places += await upsertFacilityPlace(trx, institution, row.institution_id, place);
      }
    }
    for (const place of institutions.flatMap((institution) => institution.places ?? [])) {
      for (const old of place.legacySlugs ?? []) {
        await sql`select place.merge_place(${old}, ${place.slug})`.execute(trx);
        merged += 1;
      }
    }
    return { institutions: institutions.length, places, merged };
  });
}

function sameSortedIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function isoDay(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function effectiveFacts(facts: readonly PandaEnrichmentFact[]): PandaEnrichmentFact[] {
  const expanded = [...facts];
  const birthDate = facts.find((fact) => fact.fieldKey === "birth_date");
  if (birthDate !== undefined && !facts.some((fact) => fact.fieldKey === "birth_date_precision")) {
    expanded.push({
      fieldKey: "birth_date_precision",
      value: "day",
      certainty: birthDate.certainty,
      lastVerifiedOn: birthDate.lastVerifiedOn,
      sourceKeys: birthDate.sourceKeys,
    });
  }
  return expanded;
}

async function resolveEnrichmentIds(
  trx: Kysely<Database>,
  document: PandaEnrichmentDocument,
): Promise<{ pandaIds: Map<string, string>; placeIds: Map<string, string> }> {
  const neededPandaSlugs = [
    ...new Set(
      document.items.flatMap((item) => [
        item.pandaSlug,
        ...(item.lineage?.mother ? [item.lineage.mother.parentSlug] : []),
        ...(item.lineage?.father ? [item.lineage.father.parentSlug] : []),
      ]),
    ),
  ];
  const pandaRows = await trx
    .selectFrom("panda.slugs")
    .select(["slug", "panda_id"])
    .where("slug", "in", neededPandaSlugs)
    .where("slug_kind", "=", "canonical")
    .where("valid_to", "is", null)
    .execute();
  const pandaIds = new Map(pandaRows.map((row) => [row.slug, row.panda_id]));
  const missingPandas = neededPandaSlugs.filter((slug) => !pandaIds.has(slug));
  if (missingPandas.length > 0) {
    throw new Error(`Unknown canonical panda slugs in panda-enrichment: ${missingPandas.join(", ")}.`);
  }

  const neededPlaceSlugs = [
    ...new Set(
      document.items.flatMap((item) => (item.currentResidency ? [item.currentResidency.placeSlug] : [])),
    ),
  ];
  const placeIds = new Map<string, string>();
  if (neededPlaceSlugs.length > 0) {
    const placeRows = await trx
      .selectFrom("place.places")
      .select(["slug", "place_id", "place_type"])
      .where("slug", "in", neededPlaceSlugs)
      .execute();
    const bySlug = new Map(placeRows.map((row) => [row.slug, row]));
    const missingPlaces: string[] = [];
    const nonFacilityPlaces: string[] = [];
    for (const slug of neededPlaceSlugs) {
      const row = bySlug.get(slug);
      if (row === undefined) missingPlaces.push(slug);
      else if (row.place_type !== "facility") nonFacilityPlaces.push(slug);
      else placeIds.set(slug, row.place_id);
    }
    if (missingPlaces.length > 0 || nonFacilityPlaces.length > 0) {
      const parts = [
        ...(missingPlaces.length > 0 ? [`missing facility places (${missingPlaces.join(", ")})`] : []),
        ...(nonFacilityPlaces.length > 0 ? [`non-facility places (${nonFacilityPlaces.join(", ")})`] : []),
      ];
      throw new Error(
        `Invalid place slugs in panda-enrichment: ${parts.join("; ")}. Run curation.content with data/curation/institutions/institutions.json first.`,
      );
    }
  }
  return { pandaIds, placeIds };
}

async function applyEnrichmentFact(
  trx: Kysely<Database>,
  pandaId: string,
  pandaSlug: string,
  fact: PandaEnrichmentFact,
  sourceIds: string[],
): Promise<boolean> {
  const current = await trx
    .selectFrom("panda.fact_conclusions")
    .select(["conclusion_id", "value_json", "status", "superseded_values_json"])
    .where("panda_id", "=", pandaId)
    .where("field_key", "=", fact.fieldKey)
    .where("is_current", "=", true)
    .forUpdate()
    .executeTakeFirst();

  if (current !== undefined) {
    const linked = await trx
      .selectFrom("panda.fact_conclusion_assertions as conclusion_assertion")
      .innerJoin(
        "panda.fact_assertion_sources as assertion_source",
        "assertion_source.assertion_id",
        "conclusion_assertion.assertion_id",
      )
      .select("assertion_source.source_id")
      .where("conclusion_assertion.conclusion_id", "=", current.conclusion_id)
      .execute();
    const existingSourceIds = [...new Set(linked.map((row) => row.source_id))];
    if (
      JSON.stringify(current.value_json) === JSON.stringify(fact.value) &&
      current.status === fact.certainty &&
      sameSortedIds(existingSourceIds, sourceIds)
    ) {
      return false;
    }
  }

  const priorActive = await trx
    .selectFrom("panda.fact_assertions")
    .select("assertion_id")
    .where("panda_id", "=", pandaId)
    .where("field_key", "=", fact.fieldKey)
    .where("lifecycle_state", "=", "active")
    .orderBy("created_at", "desc")
    .forUpdate()
    .execute();
  if (priorActive.length > 1) {
    await trx
      .updateTable("panda.fact_assertions")
      .set({ lifecycle_state: "superseded" })
      .where(
        "assertion_id",
        "in",
        priorActive.slice(1).map((row) => row.assertion_id),
      )
      .execute();
  }

  const priorSuperseded = Array.isArray(current?.superseded_values_json)
    ? (current.superseded_values_json as JsonValue[])
    : [];
  const nextValueJson = JSON.stringify(fact.value);
  const previousValue =
    current !== undefined &&
    current.value_json !== null &&
    JSON.stringify(current.value_json) !== nextValueJson &&
    !priorSuperseded.some((entry) => JSON.stringify(entry) === JSON.stringify(current.value_json))
      ? [current.value_json as JsonValue]
      : [];

  const assertionId = `pa:enrichment:${pandaSlug}:${fact.fieldKey}:${randomUUID()}`;
  await recordFactAssertion(trx, {
    assertionId,
    pandaId,
    fieldKey: fact.fieldKey,
    value: fact.value,
    certainty: fact.certainty,
    lastVerifiedOn: fact.lastVerifiedOn,
    ...(priorActive[0] === undefined ? {} : { supersedesAssertionId: priorActive[0].assertion_id }),
    sourceIds,
  });
  await setCurrentFactConclusion(trx, {
    pandaId,
    fieldKey: fact.fieldKey,
    value: fact.value,
    status: fact.certainty,
    lastVerifiedOn: fact.lastVerifiedOn,
    supersededValues: [...previousValue, ...priorSuperseded],
    assertionIds: [assertionId],
  });
  return true;
}

async function applyEnrichmentResidency(
  trx: Kysely<Database>,
  pandaId: string,
  pandaSlug: string,
  targetPlaceId: string,
  residency: NonNullable<PandaEnrichmentDocument["items"][number]["currentResidency"]>,
  sourceIds: string[],
  fallbackCloseOn: string,
): Promise<boolean> {
  const existingRows = await trx
    .selectFrom("life_history.residencies")
    .selectAll()
    .where("panda_id", "=", pandaId)
    .forUpdate()
    .execute();
  const openPrimary = existingRows.filter((row) => row.residency_type === "primary" && isoDay(row.end_on) === null);
  const [only] = openPrimary;

  if (openPrimary.length === 1 && only !== undefined) {
    if (
      only.place_id === targetPlaceId &&
      isoDay(only.start_on) === residency.startOn &&
      only.start_precision === residency.startPrecision &&
      only.status === residency.status
    ) {
      const linked = await trx
        .selectFrom("life_history.residency_sources")
        .select("source_id")
        .where("residency_id", "=", only.residency_id)
        .execute();
      if (sameSortedIds(linked.map((row) => row.source_id), sourceIds)) {
        return false;
      }
    }
  }

  const reuseOpen = openPrimary.find((row) => row.place_id === targetPlaceId);
  const targetResidencyId = reuseOpen?.residency_id ?? `res:panda-enrichment:${pandaSlug}:${residency.placeSlug}`;

  for (const other of existingRows) {
    if (other.residency_type !== "primary" || other.residency_id === targetResidencyId) continue;
    const otherStart = isoDay(other.start_on);
    const otherEnd = isoDay(other.end_on);

    if (otherEnd === null) {
      let closeOn: string;
      let closePrecision: string;
      if (residency.startOn !== null) {
        if (otherStart === null || otherStart <= residency.startOn) {
          closeOn = residency.startOn;
          closePrecision = residency.startPrecision;
        } else {
          closeOn = otherStart;
          closePrecision = other.start_precision;
        }
      } else {
        closeOn = otherStart !== null && otherStart > fallbackCloseOn ? otherStart : fallbackCloseOn;
        closePrecision = "day";
      }
      await trx
        .updateTable("life_history.residencies")
        .set({ end_on: closeOn, end_precision: closePrecision, updated_at: sql`now()` })
        .where("residency_id", "=", other.residency_id)
        .execute();
    } else if (residency.startOn !== null && otherStart !== null && otherEnd > residency.startOn) {
      const clampOn = otherStart <= residency.startOn ? residency.startOn : otherStart;
      const clampPrecision = otherStart <= residency.startOn ? residency.startPrecision : other.start_precision;
      await trx
        .updateTable("life_history.residencies")
        .set({ end_on: clampOn, end_precision: clampPrecision, updated_at: sql`now()` })
        .where("residency_id", "=", other.residency_id)
        .execute();
    }
  }

  await trx
    .insertInto("life_history.residencies")
    .values({
      residency_id: targetResidencyId,
      panda_id: pandaId,
      place_id: targetPlaceId,
      residency_type: "primary",
      start_on: residency.startOn,
      start_precision: residency.startPrecision,
      end_on: null,
      end_precision: null,
      status: residency.status,
    })
    .onConflict((conflict) =>
      conflict.column("residency_id").doUpdateSet({
        place_id: targetPlaceId,
        residency_type: "primary",
        start_on: residency.startOn,
        start_precision: residency.startPrecision,
        end_on: null,
        end_precision: null,
        status: residency.status,
        updated_at: sql`now()`,
      }),
    )
    .execute();

  await trx.deleteFrom("life_history.residency_sources").where("residency_id", "=", targetResidencyId).execute();
  await trx
    .insertInto("life_history.residency_sources")
    .values(sourceIds.map((sourceId) => ({ residency_id: targetResidencyId, source_id: sourceId })))
    .execute();
  return true;
}

async function applyEnrichmentParent(
  trx: Kysely<Database>,
  pandaId: string,
  pandaSlug: string,
  role: "mother" | "father",
  parent: PandaEnrichmentParent,
  targetParentId: string,
  sourceIds: string[],
): Promise<boolean> {
  const existing = await trx
    .selectFrom("lineage.parentage_assertions")
    .selectAll()
    .where("child_id", "=", pandaId)
    .where("parent_role", "=", role)
    .forUpdate()
    .execute();

  const matching = existing.find((row) => row.parent_id === targetParentId && row.status === parent.status);
  if (matching !== undefined) {
    const linked = await trx
      .selectFrom("lineage.parentage_assertion_sources")
      .select("source_id")
      .where("assertion_id", "=", matching.assertion_id)
      .execute();
    const existingReviewed = isoDay(matching.reviewed_at);
    const sameReviewed = parent.reviewedOn === undefined || existingReviewed === parent.reviewedOn;
    if (sameReviewed && sameSortedIds(linked.map((row) => row.source_id), sourceIds)) {
      return false;
    }
  }

  if (parent.status === "confirmed") {
    const conflictingIds = existing
      .filter((row) => row.status === "confirmed" && row.parent_id !== targetParentId)
      .map((row) => row.assertion_id);
    if (conflictingIds.length > 0) {
      await trx
        .updateTable("lineage.parentage_assertions")
        .set({ status: "superseded", updated_at: sql`now()` })
        .where("assertion_id", "in", conflictingIds)
        .execute();
    }
  }

  const assertionId = matching?.assertion_id ?? `lin:panda-enrichment:${pandaSlug}:${role}:${parent.parentSlug}`;
  const reviewedAt = parent.reviewedOn === undefined ? null : new Date(`${parent.reviewedOn}T00:00:00Z`);
  await trx
    .insertInto("lineage.parentage_assertions")
    .values({
      assertion_id: assertionId,
      child_id: pandaId,
      parent_id: targetParentId,
      parent_role: role,
      status: parent.status,
      reviewed_at: reviewedAt,
    })
    .onConflict((conflict) =>
      conflict.column("assertion_id").doUpdateSet({
        child_id: pandaId,
        parent_id: targetParentId,
        parent_role: role,
        status: parent.status,
        reviewed_at: reviewedAt,
        updated_at: sql`now()`,
      }),
    )
    .execute();

  await trx.deleteFrom("lineage.parentage_assertion_sources").where("assertion_id", "=", assertionId).execute();
  await trx
    .insertInto("lineage.parentage_assertion_sources")
    .values(sourceIds.map((sourceId) => ({ assertion_id: assertionId, source_id: sourceId })))
    .execute();
  return true;
}

/**
 * One transaction: upserts curated sources and applies primary-source-verified panda facts,
 * non-overlapping primary residencies, and parentage assertions idempotently by canonical slug.
 */
export async function writePandaEnrichment(db: Kysely<Database>, raw: unknown): Promise<ContentReport> {
  const document = parsePandaEnrichment(raw);
  const inTransaction = <T>(work: (trx: Kysely<Database>) => Promise<T>) =>
    db.isTransaction ? work(db) : db.transaction().execute(work);

  return inTransaction(async (trx) => {
    const { pandaIds, placeIds } = await resolveEnrichmentIds(trx, document);
    const sourceIdsByKey = new Map<string, string>();
    for (const source of document.sources) {
      const sourceId = `src:panda-enrichment:${source.key}`;
      sourceIdsByKey.set(source.key, sourceId);
      await trx
        .insertInto("evidence.sources")
        .values({
          source_id: sourceId,
          publisher: source.publisher,
          title: source.title,
          url: source.url,
          published_on: source.publishedOn ?? null,
          last_verified_on: source.lastVerifiedOn,
          language_tag: source.languageTag,
          access_state: source.accessState,
          evidence_tier: source.evidenceTier ?? null,
          public_summary: source.publicSummary ?? null,
        })
        .onConflict((conflict) =>
          conflict.column("source_id").doUpdateSet({
            publisher: source.publisher,
            title: source.title,
            url: source.url,
            published_on: source.publishedOn ?? null,
            last_verified_on: source.lastVerifiedOn,
            language_tag: source.languageTag,
            access_state: source.accessState,
            evidence_tier: source.evidenceTier ?? null,
            public_summary: source.publicSummary ?? null,
            updated_at: sql`now()`,
          }),
        )
        .execute();
    }

    const resolveSources = (keys: readonly string[]) =>
      [...new Set(keys.map((key) => sourceIdsByKey.get(key)!))].sort();

    let factsWritten = 0;
    let factsUnchanged = 0;
    let residenciesWritten = 0;
    let residenciesUnchanged = 0;
    let lineageWritten = 0;
    let lineageUnchanged = 0;

    for (const item of document.items) {
      const pandaId = pandaIds.get(item.pandaSlug)!;
      for (const fact of effectiveFacts(item.facts)) {
        const changed = await applyEnrichmentFact(trx, pandaId, item.pandaSlug, fact, resolveSources(fact.sourceKeys));
        if (changed) factsWritten += 1;
        else factsUnchanged += 1;
      }

      if (item.currentResidency !== undefined) {
        const residency = item.currentResidency;
        const targetPlaceId = placeIds.get(residency.placeSlug)!;
        const fallbackCloseOn = residency.lastVerifiedOn ?? document.updatedAt.slice(0, 10);
        const changed = await applyEnrichmentResidency(
          trx,
          pandaId,
          item.pandaSlug,
          targetPlaceId,
          residency,
          resolveSources(residency.sourceKeys),
          fallbackCloseOn,
        );
        if (changed) residenciesWritten += 1;
        else residenciesUnchanged += 1;
      }

      if (item.lineage !== undefined) {
        const roles: Array<["mother" | "father", PandaEnrichmentParent | undefined]> = [
          ["mother", item.lineage.mother],
          ["father", item.lineage.father],
        ];
        for (const [role, parent] of roles) {
          if (parent === undefined) continue;
          const targetParentId = pandaIds.get(parent.parentSlug)!;
          const changed = await applyEnrichmentParent(
            trx,
            pandaId,
            item.pandaSlug,
            role,
            parent,
            targetParentId,
            resolveSources(parent.sourceKeys),
          );
          if (changed) lineageWritten += 1;
          else lineageUnchanged += 1;
        }
      }
    }

    const outcome =
      factsWritten === 0 && residenciesWritten === 0 && lineageWritten === 0 ? "already current" : "written";
    return {
      kind: "panda-enrichment",
      version: document.version,
      outcome,
      counts: {
        items: document.items.length,
        sources: document.sources.length,
        factsWritten,
        factsUnchanged,
        residenciesWritten,
        residenciesUnchanged,
        lineageWritten,
        lineageUnchanged,
      },
    };
  });
}

/** Parses the file as the API will read it, so a document the API would refuse is never written. */
export async function writeContent(db: Kysely<Database>, kind: ContentKind, file: unknown): Promise<ContentReport> {
  if (kind === "institutions") {
    return { kind, outcome: "written", counts: await writeInstitutions(db, institutionsOf(file)) };
  }
  if (kind === "panda-enrichment") {
    return writePandaEnrichment(db, file);
  }
  const document = file as { version?: unknown; items?: unknown };
  const version = typeof document?.version === "string" ? document.version : "";
  if (!version) throw new Error(`${kind} needs a version.`);
  const row = { version, document: file };
  const catalogs = {
    "venue-news": { table: "place.venue_news_catalog", count: () => publishedVenueNews(row).items.length },
    "overseas-status": { table: "place.overseas_status_catalog", count: () => publishedOverseasStatus(row).items.length },
    comparisons: { table: "place.comparison_catalog", count: () => publishedComparisons(row).items.length },
  } as const satisfies Record<Exclude<ContentKind, "institutions" | "panda-enrichment">, { table: CatalogTable; count: () => number }>;
  const { table, count } = catalogs[kind];
  const published = count();
  return { kind, version, ...(await writeCatalog(db, table, version, file)), counts: { published } };
}

export function renderContentReport(report: ContentReport): string {
  return [
    `## ${report.kind}${report.version ? ` ${report.version}` : ""}: ${report.outcome}`,
    "",
    ...(report.version && report.kind !== "panda-enrichment" ? [`Replaced: ${report.previousVersion ?? "nothing"}.`, ""] : []),
    "| | Count |",
    "|---|---:|",
    ...Object.entries(report.counts).map(([name, count]) => `| ${name} | ${count} |`),
    "",
    ...(report.kind === "institutions" || report.kind === "panda-enrichment"
      ? ["Publish a release next (`release.publish`) so the app serves the change.", ""]
      : []),
  ].join("\n");
}

@Module({ imports: [ConfigModule, DatabaseModule] })
class ContentCommandModule {}

async function main(): Promise<void> {
  const manifestPath = process.env.BATCH_MANIFEST_PATH;
  if (!manifestPath) throw new Error("BATCH_MANIFEST_PATH is required.");
  const kind = contentKind(manifestPath);
  const file: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  assertVerifiedDatabase();

  const app = await NestFactory.createApplicationContext(ContentCommandModule, { logger: ["error", "warn"] });
  try {
    const report = await writeContent(app.get(DatabaseService).db, kind, file);
    await mkdir(REPORT_DIRECTORY, { recursive: true });
    await writeFile(path.join(REPORT_DIRECTORY, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    const markdown = renderContentReport(report);
    console.log(markdown);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
  } finally {
    await app.close();
  }
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith("content-command")) {
  main().catch((error: unknown) => {
    console.error(`[content] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
