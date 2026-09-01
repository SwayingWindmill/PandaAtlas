import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NestFactory } from "@nestjs/core";
import { sql } from "kysely";

const APPROVED_VERSION = "2026.07.31.1";
const RELEASE_VERSION = "2026.07.31.1-v2-recovery";
const SYSTEM_ACTOR_KEY = "production-cutover-recovery";
const APPROVED_SOURCE_SHA256 = "0c3bb311c21774d478c4586c64f20cc34d9b49a31319f5917689469d16eca0b1";
const APPROVED_MANIFEST_SHA256 = "eaf303b953c16c71ec630b989fc07e2ce1ba8e6910e0e3b5189794962fb599a1";
const EXPECTED = Object.freeze({
  pandas: 39,
  facts: 110,
  sources: 43,
  facilities: 8,
  residencies: 28,
  events: 43,
  parentage_assertions: 24,
  media: 39,
});
const V2_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const sourcePath = path.join(repoRoot, "data", "reviewed-batches", APPROVED_VERSION, "source.json");
const releaseDir = path.join(repoRoot, "data", "public-releases", APPROVED_VERSION);
const manifestPath = path.join(releaseDir, "manifest.json");
const apply = process.argv.includes("--apply");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function md5Uuid(label) {
  const digest = createHash("md5").update(label).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
}

function coarsePlaceId(label) {
  return md5Uuid(`coarse-location:${label.trim().toLowerCase()}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function published(records) {
  return records.filter((record) => record.publication_status === "published");
}

function nameKind(kind) {
  if (kind === "alternate_romanization") return "alias";
  if (kind === "romanized") return "official_romanization";
  if (["official", "official_romanization", "pinyin", "alias", "historic_spelling", "historical_name", "nickname"].includes(kind)) {
    return kind;
  }
  throw new Error(`Unsupported approved name kind: ${kind}`);
}

function languageName(names, prefix) {
  return names.find((name) => String(name.language).startsWith(prefix))?.value;
}

function normalizeIdentityTerm(value) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function unique(values) {
  return [...new Set(values)];
}

function v2LegacySlugs(record) {
  const canonicalSlug = record.public.canonical_slug;
  assert(V2_SLUG_PATTERN.test(canonicalSlug), `Approved canonical slug is not V2-compatible: ${canonicalSlug}.`);
  const values = [];
  for (const legacy of record.public.legacy_slugs ?? []) {
    const value = legacy.value;
    if (V2_SLUG_PATTERN.test(value)) {
      assert(value !== canonicalSlug, `Approved legacy slug duplicates canonical slug: ${value}.`);
      values.push(value);
      continue;
    }
    assert(
      value.replaceAll("_", "-") === canonicalSlug,
      `Approved legacy slug cannot be represented by the V2 slug contract: ${value}.`,
    );
  }
  return unique(values);
}

async function loadApprovedBundle() {
  const [sourceBytes, manifestBytes] = await Promise.all([readFile(sourcePath), readFile(manifestPath)]);
  assert(sha256(sourceBytes) === APPROVED_SOURCE_SHA256, "Approved reviewed source SHA-256 differs from the governed recovery anchor.");
  assert(sha256(manifestBytes) === APPROVED_MANIFEST_SHA256, "Approved manifest SHA-256 differs from the governed recovery anchor.");

  const source = JSON.parse(sourceBytes.toString("utf8"));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert(source?.dataset?.version === APPROVED_VERSION, "Reviewed source version is not the approved recovery version.");
  assert(source?.dataset?.core_panda_count === EXPECTED.pandas, "Reviewed source core Panda count differs from the approved recovery anchor.");
  assert(manifest.dataset_release_version === APPROVED_VERSION, "Manifest version is not the approved recovery version.");

  for (const [key, expected] of Object.entries(EXPECTED)) {
    const actual = source[key]?.length ?? 0;
    assert(actual === expected, `Approved source ${key} count differs: ${actual} != ${expected}.`);
  }
  assert(manifest.record_counts.pandas === EXPECTED.pandas, "Manifest Panda count differs from the approved recovery anchor.");
  assert(manifest.record_counts.facts === EXPECTED.facts, "Manifest fact count differs from the approved recovery anchor.");
  assert(manifest.record_counts.sources === EXPECTED.sources, "Manifest source count differs from the approved recovery anchor.");
  assert(manifest.record_counts.parentage_assertions === EXPECTED.parentage_assertions, "Manifest lineage count differs from the approved recovery anchor.");
  assert(manifest.record_counts.residencies === EXPECTED.residencies, "Manifest residency count differs from the approved recovery anchor.");
  assert(manifest.record_counts.events === EXPECTED.events, "Manifest event count differs from the approved recovery anchor.");

  for (const [filename, metadata] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(releaseDir, filename));
    assert(bytes.length === metadata.bytes, `Approved artifact byte count differs: ${filename}.`);
    assert(sha256(bytes) === metadata.sha256, `Approved artifact SHA-256 differs: ${filename}.`);
  }

  for (const record of published(source.pandas)) v2LegacySlugs(record);
  const coreIds = new Set(source.pandas.map((record) => record.id));
  const dependencyIds = new Set((source.related_pandas ?? []).map((record) => record.id));
  assert(dependencyIds.size === 2, "Approved recovery expects exactly two dependency Panda identities.");
  const facilityIds = new Set(source.facilities.map((record) => record.id));
  const sourceIds = new Set(source.sources.map((record) => record.id));

  const pandaFieldKeys = new Set();
  for (const fact of source.facts) {
    assert(fact.public.conclusion_status === "confirmed", `Approved fact ${fact.id} is not confirmed.`);
    assert(coreIds.has(fact.public.subject_id), `Approved fact ${fact.id} references a non-core Panda.`);
    const key = `${fact.public.subject_id}|${fact.public.field}`;
    assert(!pandaFieldKeys.has(key), `Approved facts contain duplicate Panda field ${key}.`);
    pandaFieldKeys.add(key);
    for (const sourceId of fact.public.source_ids ?? []) assert(sourceIds.has(sourceId), `Approved fact ${fact.id} references unknown source ${sourceId}.`);
  }
  for (const assertion of source.parentage_assertions) {
    assert(coreIds.has(assertion.public.child_id), `Approved lineage ${assertion.id} has a non-core child.`);
    assert(coreIds.has(assertion.public.parent_id) || dependencyIds.has(assertion.public.parent_id), `Approved lineage ${assertion.id} has an unknown parent.`);
    for (const sourceId of assertion.public.source_ids ?? []) assert(sourceIds.has(sourceId), `Approved lineage ${assertion.id} references unknown source ${sourceId}.`);
  }
  for (const residency of source.residencies) {
    assert(coreIds.has(residency.public.panda_id), `Approved residency ${residency.id} references an unknown Panda.`);
    if (residency.public.facility_id) assert(facilityIds.has(residency.public.facility_id), `Approved residency ${residency.id} references an unknown facility.`);
  }
  for (const event of source.events) {
    for (const pandaId of event.public.participants ?? []) assert(coreIds.has(pandaId), `Approved event ${event.id} references an unknown Panda.`);
    for (const facilityId of [event.public.from_facility_id, event.public.to_facility_id].filter(Boolean)) {
      assert(facilityIds.has(facilityId), `Approved event ${event.id} references an unknown facility.`);
    }
  }
  return { source, manifest, coreIds, dependencyIds, sourceIds };
}

async function count(transaction, table) {
  const result = await sql`select count(*)::integer as count from ${sql.table(table)}`.execute(transaction);
  return result.rows[0].count;
}

async function authorityState(db, bundle) {
  const tables = {
    pandas: "panda.pandas",
    facts: "panda.fact_assertions",
    conclusions: "panda.fact_conclusions",
    sources: "evidence.sources",
    places: "place.places",
    residencies: "life_history.residencies",
    events: "life_history.events",
    lineage: "lineage.parentage_assertions",
  };
  const counts = Object.fromEntries(await Promise.all(Object.entries(tables).map(async ([key, table]) => [key, await count(db, table)])));
  if (Object.values(counts).every((value) => value === 0)) return { kind: "empty", counts };

  const expectedPandaIds = new Set([...bundle.coreIds, ...bundle.dependencyIds]);
  const pandas = await sql`select panda_id::text as id from panda.pandas order by panda_id`.execute(db);
  const sources = await sql`select source_id as id from evidence.sources order by source_id`.execute(db);
  const pandaIds = new Set(pandas.rows.map((row) => row.id));
  const sourceIds = new Set(sources.rows.map((row) => row.id));
  const exactSets = pandaIds.size === expectedPandaIds.size
    && [...expectedPandaIds].every((id) => pandaIds.has(id))
    && sourceIds.size === bundle.sourceIds.size
    && [...bundle.sourceIds].every((id) => sourceIds.has(id));
  const expectedCounts = counts.pandas === expectedPandaIds.size
    && counts.facts === EXPECTED.facts
    && counts.conclusions === EXPECTED.facts
    && counts.sources === EXPECTED.sources
    && counts.residencies === EXPECTED.residencies
    && counts.events === EXPECTED.events
    && counts.lineage === EXPECTED.parentage_assertions;
  if (exactSets && expectedCounts) return { kind: "complete", counts };
  return { kind: "partial", counts };
}

async function insertEvidence(transaction, source) {
  for (const record of published(source.sources)) {
    const item = record.public;
    const internalNotes = record.restricted?.curator_notes?.trim() || null;
    const contentHash = record.restricted?.content_hash;
    await sql`
      insert into evidence.sources (
        source_id,publisher,title,url,published_on,last_verified_on,language_tag,
        access_state,evidence_tier,public_summary,internal_notes,content_sha256
      ) values (
        ${record.id},${item.publisher},${item.title},${item.url},${item.published_at ?? null},
        ${item.last_verified_at},${item.language},${item.access_state},${item.evidence_tier ?? null},
        ${item.public_summary ?? null},${internalNotes},${typeof contentHash === "string" && /^[0-9a-f]{64}$/.test(contentHash) ? contentHash : null}
      )
    `.execute(transaction);
  }
}

async function insertPandas(transaction, source) {
  for (const record of [...published(source.pandas), ...published(source.related_pandas ?? [])]) {
    await sql`insert into panda.pandas (panda_id) values (${record.id}::uuid)`.execute(transaction);
  }

  for (const record of published(source.pandas)) {
    const item = record.public;
    await sql`insert into panda.slugs (panda_id,slug,slug_kind) values (${record.id}::uuid,${item.canonical_slug},'canonical')`.execute(transaction);
    for (const legacySlug of v2LegacySlugs(record)) {
      await sql`insert into panda.slugs (panda_id,slug,slug_kind) values (${record.id}::uuid,${legacySlug},'legacy')`.execute(transaction);
    }

    const mergedNames = new Map();
    for (const candidate of [...(item.names ?? []), ...(item.aliases ?? [])]) {
      const mapped = {
        language: candidate.language,
        kind: nameKind(candidate.kind),
        value: candidate.value,
        primary: candidate.primary === true,
        sourceIds: candidate.source_ids ?? [],
      };
      const key = `${mapped.language}|${mapped.kind}|${mapped.value}`;
      const existing = mergedNames.get(key);
      if (existing) {
        existing.primary ||= mapped.primary;
        existing.sourceIds = unique([...existing.sourceIds, ...mapped.sourceIds]);
      } else {
        mergedNames.set(key, mapped);
      }
    }
    const primaryLanguages = new Set();
    for (const name of mergedNames.values()) {
      if (name.primary) {
        assert(!primaryLanguages.has(name.language), `Panda ${record.id} has multiple primary names for ${name.language}.`);
        primaryLanguages.add(name.language);
      }
      const inserted = await sql`
        insert into panda.names (panda_id,language_tag,name_kind,value,normalized_value,is_primary)
        values (${record.id}::uuid,${name.language},${name.kind},${name.value},${normalizeIdentityTerm(name.value)},${name.primary})
        returning name_id::text as id
      `.execute(transaction);
      const nameId = inserted.rows[0].id;
      for (const sourceId of unique(name.sourceIds)) {
        await sql`insert into panda.name_sources (name_id,source_id) values (${nameId}::uuid,${sourceId})`.execute(transaction);
      }
    }

    for (const external of item.external_identifiers ?? []) {
      const inserted = await sql`
        insert into panda.external_identifiers (panda_id,system,value,normalized_value)
        values (${record.id}::uuid,${external.system},${external.value},${normalizeIdentityTerm(external.value)})
        returning external_identifier_id::text as id
      `.execute(transaction);
      for (const sourceId of unique(external.source_ids ?? [])) {
        await sql`insert into panda.external_identifier_sources (external_identifier_id,source_id) values (${inserted.rows[0].id}::uuid,${sourceId})`.execute(transaction);
      }
    }
  }
}

async function insertFacts(transaction, source) {
  for (const record of published(source.facts)) {
    const item = record.public;
    await sql`
      insert into panda.fact_assertions (assertion_id,panda_id,field_key,value_json,certainty,last_verified_on)
      values (${record.id},${item.subject_id}::uuid,${item.field},${JSON.stringify(item.value)}::jsonb,'confirmed',${item.last_verified_at})
    `.execute(transaction);
    for (const sourceId of unique(item.source_ids ?? [])) {
      await sql`insert into panda.fact_assertion_sources (assertion_id,source_id,stance) values (${record.id},${sourceId},'supports')`.execute(transaction);
    }
    const conclusion = await sql`
      insert into panda.fact_conclusions (
        panda_id,field_key,value_json,status,last_verified_on,candidate_values_json,
        superseded_values_json,conclusion_version,is_current
      ) values (
        ${item.subject_id}::uuid,${item.field},${JSON.stringify(item.value)}::jsonb,'confirmed',${item.last_verified_at},
        '[]'::jsonb,'[]'::jsonb,1,true
      ) returning conclusion_id::text as id
    `.execute(transaction);
    await sql`insert into panda.fact_conclusion_assertions (conclusion_id,assertion_id) values (${conclusion.rows[0].id}::uuid,${record.id})`.execute(transaction);
  }
}

async function insertPlaces(transaction, source) {
  for (const record of published(source.facilities)) {
    const item = record.public;
    const names = item.names ?? [];
    await sql`
      insert into place.places (
        place_id,institution_id,slug,place_type,name_zh,name_en,country_code,region
      ) values (
        ${record.id}::uuid,null,${item.canonical_slug},'facility',${languageName(names, "zh") ?? null},
        ${languageName(names, "en") ?? null},${item.country_code ?? null},${item.locality ?? null}
      )
    `.execute(transaction);
  }

  const labels = unique([
    ...source.residencies.map((record) => record.public.coarse_location).filter(Boolean),
    ...source.events.flatMap((record) => [record.public.from_coarse_location, record.public.to_coarse_location]).filter(Boolean),
  ].map((label) => label.trim()));
  for (const label of labels) {
    const placeId = coarsePlaceId(label);
    const slug = `coarse-${createHash("md5").update(`coarse-location:${label.toLowerCase()}`).digest("hex").slice(0, 16)}`;
    await sql`
      insert into place.places (place_id,institution_id,slug,place_type,name_zh,name_en,country_code,region)
      values (${placeId}::uuid,null,${slug},'coarse_location',null,${label},null,${label})
    `.execute(transaction);
  }
}

async function insertLifeHistory(transaction, source) {
  for (const record of published(source.residencies)) {
    const item = record.public;
    const placeId = item.facility_id ?? coarsePlaceId(item.coarse_location);
    await sql`
      insert into life_history.residencies (
        residency_id,panda_id,place_id,residency_type,start_on,start_precision,end_on,end_precision,status
      ) values (
        ${record.id},${item.panda_id}::uuid,${placeId}::uuid,${item.residency_type},${item.start_date ?? null},
        ${item.start_date ? "day" : "unknown"},${item.end_date ?? null},${item.end_date ? "day" : null},${item.status}
      )
    `.execute(transaction);
    for (const sourceId of unique(item.source_ids ?? [])) {
      await sql`insert into life_history.residency_sources (residency_id,source_id) values (${record.id},${sourceId})`.execute(transaction);
    }
  }

  for (const record of published(source.events)) {
    const item = record.public;
    const fromPlaceId = item.from_facility_id ?? (item.from_coarse_location ? coarsePlaceId(item.from_coarse_location) : null);
    const toPlaceId = item.to_facility_id ?? (item.to_coarse_location ? coarsePlaceId(item.to_coarse_location) : null);
    await sql`
      insert into life_history.events (
        event_id,event_type,event_status,occurred_on,occurred_precision,from_place_id,to_place_id,summary
      ) values (
        ${record.id},${item.event_type},${item.event_status},${item.event_date ?? null},${item.event_date ? (item.event_date_precision ?? "day") : "unknown"},
        ${fromPlaceId}::uuid,${toPlaceId}::uuid,null
      )
    `.execute(transaction);
    for (const pandaId of unique(item.participants ?? [])) {
      await sql`insert into life_history.event_participants (event_id,panda_id,participant_role) values (${record.id},${pandaId}::uuid,'subject')`.execute(transaction);
    }
    for (const sourceId of unique(item.source_ids ?? [])) {
      await sql`insert into life_history.event_sources (event_id,source_id) values (${record.id},${sourceId})`.execute(transaction);
    }
  }
}

async function insertLineage(transaction, source) {
  for (const record of published(source.parentage_assertions)) {
    const item = record.public;
    await sql`
      insert into lineage.parentage_assertions (assertion_id,child_id,parent_id,parent_role,status,reviewed_at)
      values (${record.id},${item.child_id}::uuid,${item.parent_id}::uuid,${item.role},${item.status},null)
    `.execute(transaction);
    for (const sourceId of unique(item.source_ids ?? [])) {
      await sql`insert into lineage.parentage_assertion_sources (assertion_id,source_id) values (${record.id},${sourceId})`.execute(transaction);
    }
  }
}

async function importAuthority(database, source) {
  await database.db.transaction().setIsolationLevel("serializable").execute(async (transaction) => {
    await insertEvidence(transaction, source);
    await insertPandas(transaction, source);
    await insertFacts(transaction, source);
    await insertPlaces(transaction, source);
    await insertLifeHistory(transaction, source);
    await insertLineage(transaction, source);
  });
}

async function publish(publication, database) {
  const context = { actor: { kind: "system", systemKey: SYSTEM_ACTOR_KEY }, correlationId: randomUUID() };
  const existing = await sql`
    select release_id::text as release_id,lifecycle_state
    from publication.releases where version=${RELEASE_VERSION}
  `.execute(database.db);
  let release;
  if (existing.rows.length === 0) {
    release = await publication.build(RELEASE_VERSION, context);
  } else {
    release = await publication.getRelease(existing.rows[0].release_id);
    assert(release, "Existing recovery release could not be loaded.");
  }
  if (release.lifecycleState !== "sealed") {
    const sealed = await publication.seal(release.releaseId, context, "Seal governed approved-release V2 recovery projection");
    assert(sealed.kind === "ok", `Recovery release could not be sealed: ${sealed.kind}.`);
    release = sealed.release;
  }
  const activated = await publication.activate(release.releaseId, context, "Activate governed approved-release V2 recovery projection");
  assert(activated.kind === "ok" || activated.kind === "already_current", `Recovery release could not be activated: ${activated.kind}.`);
  return activated.release;
}

async function main() {
  const bundle = await loadApprovedBundle();
  const [{ AppModule }, { DatabaseService }, publicationModule] = await Promise.all([
    import("../../dist/app.module.js"),
    import("../../dist/platform/database/database.service.js"),
    import("../../dist/modules/publication/application/publication.application.js"),
  ]);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const database = app.get(DatabaseService);
    const publication = app.get(publicationModule.PUBLICATION_PORT);
    await database.checkReady();
    const before = await authorityState(database.db, bundle);
    if (before.kind === "partial") {
      throw new Error(`Refusing approved authority recovery over partial V2 state: ${JSON.stringify(before.counts)}`);
    }

    if (!apply) {
      console.log(JSON.stringify({ mode: "dry-run", approvedVersion: APPROVED_VERSION, releaseVersion: RELEASE_VERSION, authority: before }, null, 2));
      return;
    }
    if (before.kind === "empty") await importAuthority(database, bundle.source);
    const after = await authorityState(database.db, bundle);
    assert(after.kind === "complete", `Authority recovery did not reach the exact expected state: ${JSON.stringify(after.counts)}`);
    const release = await publish(publication, database);
    const current = await sql`
      select r.release_id::text as release_id,r.version,r.lifecycle_state
      from publication.current_release c join publication.releases r on r.release_id=c.release_id
      where c.singleton=true
    `.execute(database.db);
    assert(current.rows[0]?.release_id === release.releaseId, "Recovery release is not the current public release.");
    console.log(JSON.stringify({ mode: "applied", approvedVersion: APPROVED_VERSION, authority: after, currentRelease: current.rows[0] }, null, 2));
  } finally {
    await app.close();
  }
}

await main();
