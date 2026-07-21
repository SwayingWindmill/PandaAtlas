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

export const WEB_RELEASE_VERSION = "2026.07.21.1";
export const webReleaseDatasetPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "data",
  "reviewed-batches",
  WEB_RELEASE_VERSION,
  "source.json",
);

function legacySlugValue(value) {
  return typeof value === "string" ? value : value.value;
}

function isPublicProfileRecord(record) {
  return record.publication_status === "published"
    && ["complete_first_pass", "identity_first_pass"].includes(record.public?.record_tier);
}

export function buildTrustedIdentityReferences(dataset) {
  const references = {};
  for (const record of dataset.pandas ?? []) {
    if (!isPublicProfileRecord(record)) continue;
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

function publicNames(record) {
  return (record.public.names ?? []).map((name) => ({
    language: name.language,
    value: name.value,
    kind: name.kind,
  }));
}

export function buildTrustedInstitutions(dataset) {
  return (dataset.institutions ?? [])
    .filter((institution) => institution.publication_status === "published")
    .map((institution) => ({
      id: institution.id,
      canonical_slug: institution.public.canonical_slug,
      legacy_slugs: institution.public.legacy_slugs ?? [],
      names: publicNames(institution),
      institution_type: institution.public.institution_type ?? null,
      facility_ids: institution.public.facility_ids ?? [],
      place_ids: institution.public.place_ids ?? [],
      source_ids: institution.public.source_ids ?? [],
      last_verified_at: institution.public.last_verified_at ?? null,
      revision_summaries: institution.public.revision_summaries ?? [],
    }))
    .sort((left, right) => left.canonical_slug.localeCompare(right.canonical_slug));
}

export function buildTrustedPlaces(dataset) {
  return (dataset.places ?? [])
    .filter((place) => place.publication_status === "published")
    .map((place) => ({
      id: place.id,
      canonical_slug: place.public.canonical_slug,
      legacy_slugs: place.public.legacy_slugs ?? [],
      names: publicNames(place),
      country_code: place.public.country_code ?? null,
      locality: place.public.locality ?? null,
      precision: place.public.precision,
      place_type: place.public.place_type ?? null,
      facility_ids: place.public.facility_ids ?? [],
      institution_ids: place.public.institution_ids ?? [],
      source_ids: place.public.source_ids ?? [],
      last_verified_at: place.public.last_verified_at ?? null,
      revision_summaries: place.public.revision_summaries ?? [],
    }))
    .sort((left, right) => left.canonical_slug.localeCompare(right.canonical_slug));
}

export function buildTrustedFacilities(dataset) {
  const institutions = buildTrustedInstitutions(dataset);
  return (dataset.facilities ?? [])
    .filter((facility) => facility.publication_status === "published")
    .map((facility) => {
      const institution = institutions.find((item) => item.facility_ids.includes(facility.id));
      return {
        id: facility.id,
        canonical_slug: facility.public.canonical_slug,
        legacy_slugs: institution?.legacy_slugs ?? [],
        names: publicNames(facility),
        institution_type: institution?.institution_type ?? null,
        facility_ids: [facility.id],
        place_ids: institution?.place_ids ?? [],
        source_ids: institution?.source_ids ?? [],
        last_verified_at: institution?.last_verified_at ?? null,
        revision_summaries: institution?.revision_summaries ?? [],
        country_code: facility.public.country_code ?? null,
        locality: facility.public.locality ?? null,
        facility_type: facility.public.facility_type ?? null,
      };
    })
    .sort((left, right) => left.canonical_slug.localeCompare(right.canonical_slug));
}

export function buildPublishedParentageAssertions(dataset) {
  const publishedSourceIds = new Set(
    (dataset.sources ?? [])
      .filter((source) => source.publication_status === "published")
      .map((source) => source.id),
  );
  return (dataset.parentage_assertions ?? [])
    .filter(
      (assertion) => assertion.publication_status === "published"
        && (assertion.public?.source_ids ?? []).some(
          (sourceId) => publishedSourceIds.has(sourceId),
        ),
    )
    .map((assertion) => ({
      id: assertion.id,
      child_id: assertion.public.child_id,
      parent_id: assertion.public.parent_id,
      role: assertion.public.role,
      status: assertion.public.status,
      source_ids: (assertion.public.source_ids ?? []).filter(
        (sourceId) => publishedSourceIds.has(sourceId),
      ),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function buildTrustedPandaDetails(dataset) {
  const publishedSourceIds = new Set(
    (dataset.sources ?? [])
      .filter((source) => source.publication_status === "published")
      .map((source) => source.id),
  );
  const facilities = new Map(
    (dataset.facilities ?? []).map((facility) => [facility.id, facility]),
  );
  const parentageByChild = new Map();
  for (const assertion of buildPublishedParentageAssertions(dataset)) {
    if (assertion.status !== "confirmed") continue;
    const parents = parentageByChild.get(assertion.child_id) ?? {
      father_id: null,
      mother_id: null,
    };
    parents[`${assertion.role}_id`] = assertion.parent_id;
    parentageByChild.set(assertion.child_id, parents);
  }
  return (dataset.pandas ?? [])
    .filter(isPublicProfileRecord)
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
            && (residency.public.source_ids ?? []).some(
              (sourceId) => publishedSourceIds.has(sourceId),
            ),
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
          last_verified_at: residency.public.last_verified_at ?? null,
          source_ids: (residency.public.source_ids ?? []).filter(
            (sourceId) => publishedSourceIds.has(sourceId),
          ),
        }))
        .sort((left, right) => left.start_date.localeCompare(right.start_date));
      const currentResidency = [...residencies]
        .reverse()
        .find(
          (residency) => residency.residency_type === "primary"
            && residency.start_date <= new Date().toISOString().slice(0, 10)
            && (
              residency.end_date === null
              || new Date().toISOString().slice(0, 10) < residency.end_date
            )
            && ["confirmed", "confirmed_country_level"].includes(residency.status),
        );
      const events = (dataset.events ?? [])
        .filter(
          (event) => event.publication_status === "published"
            && (event.public?.participants ?? []).includes(record.id)
            && (event.public.source_ids ?? []).some(
              (sourceId) => publishedSourceIds.has(sourceId),
            ),
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
          source_ids: (event.public.source_ids ?? []).filter(
            (sourceId) => publishedSourceIds.has(sourceId),
          ),
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
      const currentFacility = facilities.get(currentResidency?.facility_id);
      const currentLocation = currentFacility
        ? displayName(currentFacility.public, "zh-Hans")
          ?? displayName(currentFacility.public, "en")
        : currentResidency?.coarse_location ?? null;
      const approvedContent = new Map(
        (publicRecord.content ?? [])
          .filter((content) => content.translation_status === "approved")
          .map((content) => [content.locale, content.summary]),
      );
      const localizedContent = (publicRecord.content ?? [])
        .filter((content) => content.translation_status === "approved")
        .map((content) => ({ locale: content.locale, summary: content.summary }));
      const searchTerms = [
        identity.canonical_slug,
        ...identity.names.map((item) => item.value),
        ...identity.aliases.map((item) => item.value),
        ...identity.legacy_slugs.map((item) => item.value),
        ...identity.external_identifiers.flatMap((item) => [
          item.value,
          `${item.system}:${item.value}`,
        ]),
      ].filter((value, index, values) => value && values.indexOf(value) === index);
      const mediaRecords = (dataset.media ?? []).filter(
        (media) => media.publication_status === "published"
          && media.public?.panda_id === record.id,
      );
      const mediaAssets = mediaRecords
        .filter((media) => ["available", "withdrawn", "unavailable"].includes(media.public.status))
        .map((media) => ({
          id: media.id,
          panda_id: media.public.panda_id ?? null,
          url: media.public.url ?? null,
          source_url: media.public.source_url ?? null,
          rights: media.public.rights ?? null,
          credit: media.public.credit ?? null,
          alt_zh: media.public.alt_zh ?? null,
          alt_en: media.public.alt_en ?? null,
          status: media.public.status,
          sha256: media.public.sha256 ?? null,
          mime_type: media.public.mime_type ?? null,
          width: media.public.width ?? null,
          height: media.public.height ?? null,
          bytes: media.public.bytes ?? null,
          derivatives: media.public.derivatives ?? [],
          source_ids: (media.public.source_ids ?? []).filter(
            (sourceId) => publishedSourceIds.has(sourceId),
          ),
        }));
      for (const sourceId of mediaAssets.flatMap((media) => media.source_ids)) {
        sourceIds.add(sourceId);
      }
      const availableMedia = mediaAssets.find((media) => media.status === "available") ?? null;
      const parents = parentageByChild.get(record.id) ?? {
        father_id: null,
        mother_id: null,
      };
      const mediaReleaseRecord = mediaRecords.find(
        (media) => media.publication_status === "published"
          && media.public?.panda_id === record.id,
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
        cover_image_url: availableMedia?.url ?? null,
        search_terms: searchTerms,
        intro: approvedContent.get("zh-CN") ?? approvedContent.get("en") ?? null,
        birthplace: null,
        tags: ["trusted-identity", "golden-dataset"],
        father_id: parents.father_id,
        mother_id: parents.mother_id,
        habitats: [],
        media: mediaAssets,
        identity,
        conclusions,
        sources: buildSourceSummaries(dataset, sourceIds),
        current_place: currentResidency
          ? {
              facility_id: currentResidency.facility_id,
              coarse_location: currentResidency.coarse_location,
              status: currentResidency.status,
              last_verified_at: currentResidency.last_verified_at,
            }
          : null,
        residencies,
        events,
        record_tier: publicRecord.record_tier ?? null,
        localized_content: localizedContent,
        media_release: mediaAssets.length > 0
          ? {
              license_state: "licensed",
              display_mode: availableMedia ? "gallery" : "designed_empty_state",
              source_ids: [...new Set(mediaAssets.flatMap((media) => media.source_ids))],
            }
          : mediaReleaseRecord
            ? {
                license_state: mediaReleaseRecord.public.license_state,
                display_mode: mediaReleaseRecord.public.display_mode,
                source_ids: (mediaReleaseRecord.public.source_ids ?? []).filter(
                  (sourceId) => publishedSourceIds.has(sourceId),
                ),
              }
            : null,
        public_revision: {
          data_version: dataset.dataset.version,
          public_schema_version: dataset.dataset.public_schema_version,
          summaries: publicRecord.revision_summaries ?? [],
        },
      };
    });
}

export function buildTrustedLineage(dataset) {
  const publishedSources = new Set(
    (dataset.sources ?? [])
      .filter((source) => source.publication_status === "published")
      .map((source) => source.id),
  );
  const confirmedAssertions = (dataset.parentage_assertions ?? []).filter(
    (assertion) => assertion.publication_status === "published"
      && assertion.public?.status === "confirmed"
      && (assertion.public.source_ids ?? []).some((sourceId) => publishedSources.has(sourceId)),
  );
  const parentFields = new Map();
  for (const assertion of confirmedAssertions) {
    const current = parentFields.get(assertion.public.child_id) ?? {
      father_id: null,
      mother_id: null,
    };
    current[`${assertion.public.role}_id`] = assertion.public.parent_id;
    parentFields.set(assertion.public.child_id, current);
  }
  const lineageRecords = [
    ...(dataset.pandas ?? []),
    ...(dataset.related_pandas ?? []),
  ];
  const profileRecordIds = new Set(
    (dataset.pandas ?? []).filter(isPublicProfileRecord).map((record) => record.id),
  );
  const nodes = lineageRecords
    .filter((record) => record.publication_status === "published")
    .map((record) => {
      const birthDate = (dataset.facts ?? []).find(
        (fact) => fact.publication_status === "published"
          && fact.public?.subject_id === record.id
          && fact.public?.field === "birth_date",
      )?.public?.value ?? null;
      const parents = parentFields.get(record.id) ?? { father_id: null, mother_id: null };
      return {
        id: record.id,
        slug: record.public.canonical_slug,
        name_zh: displayName(record.public, "zh-Hans") ?? record.public.canonical_slug,
        name_en: displayName(record.public, "en"),
        gender: record.public.sex ?? "unknown",
        status: record.public.life_status ?? "unknown",
        birth_date: birthDate,
        current_location: null,
        cover_image_url: null,
        search_terms: [],
        intro: null,
        tags: ["trusted-archive", "golden-dataset"],
        father_id: parents.father_id,
        mother_id: parents.mother_id,
        record_tier: record.public.record_tier ?? null,
        profile_available: profileRecordIds.has(record.id),
      };
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = confirmedAssertions
    .filter(
      (assertion) => nodeIds.has(assertion.public.parent_id)
        && nodeIds.has(assertion.public.child_id),
    )
    .map((assertion) => ({
      parent_id: assertion.public.parent_id,
      child_id: assertion.public.child_id,
    }));
  return { nodes, edges };
}

export function normalizeGeneratedModule(value) {
  return value.replace(/\r\n/g, "\n");
}

export function renderTrustedIdentityAliasModule(dataset) {
  const references = buildTrustedIdentityReferences(dataset);
  const details = buildTrustedPandaDetails(dataset);
  const institutions = buildTrustedInstitutions(dataset);
  const places = buildTrustedPlaces(dataset);
  const facilities = buildTrustedFacilities(dataset);
  const parentageAssertions = buildPublishedParentageAssertions(dataset);
  const lineage = buildTrustedLineage(dataset);
  return `// Generated from reviewed Public Release ${dataset.dataset.version}.\n`
    + `// Run npm run generate:trusted-identity-aliases after changing trusted identity data.\n\n`
    + `import type { PandaDetail, PandaLineageEdge, PandaLineageNode, PublicFacilitySummary, PublicInstitutionSummary, PublicParentageAssertionSummary, PublicPlaceSummary } from \"@/lib/types\";\n\n`
    + `export interface TrustedPandaReference {\n`
    + `  id: string;\n`
    + `  slug: string;\n`
    + `}\n\n`
    + `export const TRUSTED_PANDA_REFERENCES: Readonly<Record<string, TrustedPandaReference>> = ${JSON.stringify(references, null, 2)};\n\n`
    + `export const TRUSTED_PANDA_DETAILS: PandaDetail[] = ${JSON.stringify(details, null, 2)};\n`
    + `\nexport const TRUSTED_INSTITUTIONS: PublicInstitutionSummary[] = ${JSON.stringify(institutions, null, 2)};\n`
    + `\nexport const TRUSTED_PLACES: PublicPlaceSummary[] = ${JSON.stringify(places, null, 2)};\n`
    + `\nexport const TRUSTED_FACILITIES: PublicFacilitySummary[] = ${JSON.stringify(facilities, null, 2)};\n`
    + `\nexport const TRUSTED_PARENTAGE_ASSERTIONS: PublicParentageAssertionSummary[] = ${JSON.stringify(parentageAssertions, null, 2)};\n`
    + `\nexport const TRUSTED_LINEAGE_NODES: PandaLineageNode[] = ${JSON.stringify(lineage.nodes, null, 2)};\n`
    + `\nexport const TRUSTED_LINEAGE_EDGES: PandaLineageEdge[] = ${JSON.stringify(lineage.edges, null, 2)};\n`;
}

export async function readGoldenDataset() {
  return JSON.parse(await readFile(goldenDatasetPath, "utf8"));
}

export async function readWebReleaseDataset() {
  return JSON.parse(await readFile(webReleaseDatasetPath, "utf8"));
}

async function main() {
  const dataset = await readWebReleaseDataset();
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
