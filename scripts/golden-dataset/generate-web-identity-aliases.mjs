import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { goldenDatasetPath } from "./lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const generatedIdentityAliasesPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "apps",
  "web",
  "lib",
  "generated",
  "trusted-identity-aliases.ts",
);

function legacySlugValue(value) {
  return typeof value === "string" ? value : value.value;
}

export function buildTrustedIdentityReferences(dataset) {
  const references = {};
  for (const record of dataset.pandas ?? []) {
    if (
      record.publication_status !== "published"
      || record.public?.record_tier !== "complete_first_pass"
    ) continue;
    const canonicalSlug = record.public?.canonical_slug;
    if (!canonicalSlug || !record.id) continue;
    const reference = { id: record.id, slug: canonicalSlug };
    references[canonicalSlug] = reference;
    for (const legacySlug of record.public.legacy_slugs ?? []) {
      references[legacySlugValue(legacySlug)] = reference;
    }
  }
  return Object.fromEntries(
    Object.entries(references).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function publicLegacySlugRecord(value) {
  return typeof value === "string"
    ? { value, source_ids: [] }
    : { value: value.value, source_ids: value.source_ids ?? [] };
}

function displayName(publicRecord, language) {
  return publicRecord.names?.find(
    (name) => name.language === language && name.primary,
  )?.value
    ?? publicRecord.names?.find((name) => name.language === language)?.value
    ?? null;
}

function buildSourceSummaries(dataset, sourceIds) {
  return (dataset.sources ?? [])
    .filter(
      (source) => source.publication_status === "published" && sourceIds.has(source.id),
    )
    .map((source) => ({
      id: source.id,
      publisher: source.public.publisher,
      title: source.public.title,
      url: source.public.url,
      published_at: source.public.published_at ?? null,
      last_verified_at: source.public.last_verified_at,
      language: source.public.language,
      access_state: source.public.access_state,
    }));
}

export function buildTrustedPandaDetails(dataset) {
  const facilities = new Map(
    (dataset.facilities ?? []).map((facility) => [facility.id, facility]),
  );
  return (dataset.pandas ?? [])
    .filter(
      (record) => record.publication_status === "published"
        && record.public?.record_tier === "complete_first_pass",
    )
    .map((record) => {
      const publicRecord = record.public;
      const identity = {
        stable_id: record.id,
        canonical_slug: publicRecord.canonical_slug,
        names: (publicRecord.names ?? []).map((name) => ({
          value: name.value,
          language: name.language,
          kind: name.kind,
          primary: Boolean(name.primary),
          source_ids: name.source_ids ?? [],
        })),
        aliases: (publicRecord.aliases ?? []).map((alias) => ({
          value: alias.value,
          language: alias.language,
          kind: alias.kind,
          primary: Boolean(alias.primary),
          source_ids: alias.source_ids ?? [],
        })),
        legacy_slugs: (publicRecord.legacy_slugs ?? []).map(publicLegacySlugRecord),
        external_identifiers: (publicRecord.external_identifiers ?? []).map(
          (identifier) => ({
            system: identifier.system,
            value: identifier.value,
            source_ids: identifier.source_ids ?? [],
          }),
        ),
      };
      const conclusions = (dataset.facts ?? [])
        .filter(
          (fact) => fact.publication_status === "published"
            && fact.public?.subject_id === record.id,
        )
        .map((fact) => ({
          field: fact.public.field,
          value: fact.public.value ?? null,
          status: fact.public.conclusion_status,
          last_verified_at: fact.public.last_verified_at,
          assertion_ids: [fact.id],
          source_ids: fact.public.source_ids ?? [],
          candidate_values: fact.public.candidate_values ?? [],
          superseded_values: fact.public.superseded_values ?? [],
        }))
        .sort((left, right) => left.field.localeCompare(right.field));
      const residencies = (dataset.residencies ?? [])
        .filter(
          (residency) => residency.publication_status === "published"
            && residency.public?.panda_id === record.id
            && (residency.public.source_ids ?? []).length > 0,
        )
        .map((residency) => ({
          id: residency.id,
          facility_id: residency.public.facility_id ?? null,
          coarse_location: residency.public.coarse_location ?? null,
          residency_type: residency.public.residency_type,
          start_date: residency.public.start_date,
          start_precision: residency.public.start_precision ?? "day",
          end_date: residency.public.end_date ?? null,
          end_precision: residency.public.end_precision
            ?? (residency.public.end_date ? "day" : null),
          status: residency.public.status,
          source_ids: residency.public.source_ids ?? [],
        }))
        .sort((left, right) => left.start_date.localeCompare(right.start_date));
      const currentResidency = [...residencies]
        .reverse()
        .find(
          (residency) => residency.residency_type === "primary"
            && residency.end_date === null
            && ["confirmed", "confirmed_country_level"].includes(residency.status),
        );
      const events = (dataset.events ?? [])
        .filter(
          (event) => event.publication_status === "published"
            && (event.public?.participants ?? []).includes(record.id)
            && (event.public.source_ids ?? []).length > 0,
        )
        .map((event) => ({
          id: event.id,
          event_type: event.public.event_type,
          event_status: event.public.event_status,
          event_date: event.public.event_date,
          event_date_precision: event.public.event_date_precision ?? "day",
          participants: event.public.participants ?? [],
          from_facility_id: event.public.from_facility_id ?? null,
          from_coarse_location: event.public.from_coarse_location ?? null,
          to_facility_id: event.public.to_facility_id ?? null,
          to_coarse_location: event.public.to_coarse_location ?? null,
          source_ids: event.public.source_ids ?? [],
          changes_current_residency: Boolean(event.public.changes_current_residency),
        }))
        .sort((left, right) => left.event_date.localeCompare(right.event_date));
      const sourceIds = new Set(
        [
          ...identity.names,
          ...identity.aliases,
          ...identity.legacy_slugs,
          ...identity.external_identifiers,
          ...conclusions,
          ...residencies,
          ...events,
        ].flatMap((item) => item.source_ids),
      );
      const birthDate = conclusions.find((item) => item.field === "birth_date")?.value;
      const currentFacilityId = conclusions.find(
        (item) => item.field === "current_facility_id",
      )?.value;
      const currentFacility = facilities.get(currentFacilityId);
      const currentLocation = currentFacility
        ? displayName(currentFacility.public, "zh-Hans")
          ?? displayName(currentFacility.public, "en")
        : null;
      const approvedContent = new Map(
        (publicRecord.content ?? [])
          .filter((content) => content.translation_status === "approved")
          .map((content) => [content.locale, content.summary]),
      );

      return {
        id: record.id,
        slug: publicRecord.canonical_slug,
        name_zh: displayName(publicRecord, "zh-Hans") ?? publicRecord.canonical_slug,
        name_en: displayName(publicRecord, "en"),
        gender: publicRecord.sex,
        status: publicRecord.life_status,
        birth_date: typeof birthDate === "string" ? birthDate : null,
        current_location: currentLocation,
        cover_image_url: null,
        intro: approvedContent.get("zh-CN") ?? approvedContent.get("en") ?? null,
        birthplace: null,
        tags: ["trusted-identity", "golden-dataset"],
        father_id: null,
        mother_id: null,
        habitats: [],
        media: [],
        identity,
        conclusions,
        sources: buildSourceSummaries(dataset, sourceIds),
        current_place: currentResidency
          ? {
              facility_id: currentResidency.facility_id,
              coarse_location: currentResidency.coarse_location,
              status: currentResidency.status,
            }
          : null,
        residencies,
        events,
      };
    });
}

export function normalizeGeneratedModule(value) {
  return value.replace(/\r\n/g, "\n");
}

export function renderTrustedIdentityAliasModule(dataset) {
  const references = buildTrustedIdentityReferences(dataset);
  const details = buildTrustedPandaDetails(dataset);
  return `// Generated from contracts/golden-dataset/mei-xiang-family.v1.json.\n`
    + `// Run npm run generate:trusted-identity-aliases after changing trusted identity data.\n\n`
    + `import type { PandaDetail } from \"@/lib/types\";\n\n`
    + `export interface TrustedPandaReference {\n`
    + `  id: string;\n`
    + `  slug: string;\n`
    + `}\n\n`
    + `export const TRUSTED_PANDA_REFERENCES: Readonly<Record<string, TrustedPandaReference>> = ${JSON.stringify(references, null, 2)};\n\n`
    + `export const TRUSTED_PANDA_DETAILS: PandaDetail[] = ${JSON.stringify(details, null, 2)};\n`;
}

export async function readGoldenDataset() {
  return JSON.parse(await readFile(goldenDatasetPath, "utf8"));
}

async function main() {
  const dataset = await readGoldenDataset();
  const expected = renderTrustedIdentityAliasModule(dataset);
  if (process.argv.includes("--check")) {
    const actual = await readFile(generatedIdentityAliasesPath, "utf8").catch(() => "");
    if (normalizeGeneratedModule(actual) !== normalizeGeneratedModule(expected)) {
      throw new Error(
        "Generated trusted identity aliases drifted. Run npm run generate:trusted-identity-aliases.",
      );
    }
    console.log("Generated trusted identity aliases are current.");
    return;
  }
  await mkdir(path.dirname(generatedIdentityAliasesPath), { recursive: true });
  await writeFile(generatedIdentityAliasesPath, expected, "utf8");
  console.log(`Generated ${generatedIdentityAliasesPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
