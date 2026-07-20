import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPublishedParentageAssertions,
  buildTrustedFacilities,
  buildTrustedIdentityReferences,
  buildTrustedInstitutions,
  buildTrustedPlaces,
  buildTrustedPandaDetails,
  generatedIdentityAliasesPath,
  normalizeGeneratedModule,
  readWebReleaseDataset,
  renderTrustedIdentityAliasModule,
  WEB_RELEASE_VERSION,
} from "../generate-web-identity-aliases.mjs";
import {
  buildPublicProjection,
  CORE_PANDA_SLUGS,
  GOLDEN_DATASET_CONSUMERS,
  loadGoldenDataset,
  validateGoldenDataset,
} from "../lib.mjs";

test("canonical golden dataset defines seven stable identities and complete anchor records", async () => {
  const dataset = await loadGoldenDataset();
  const report = validateGoldenDataset(dataset);

  assert.equal(report.valid, true, JSON.stringify(report.errors, null, 2));
  assert.deepEqual(
    dataset.pandas.map((record) => record.public.canonical_slug),
    CORE_PANDA_SLUGS,
  );

  for (const slug of ["mei-xiang", "tian-tian"]) {
    const panda = dataset.pandas.find((record) => record.public.canonical_slug === slug);
    assert.ok(panda);
    assert.equal(panda.public.record_tier, "complete_first_pass");
    assert.ok(panda.public.names.length >= 3);
    assert.ok(panda.public.aliases.length >= 1);
    assert.ok(panda.public.external_identifiers.length >= 1);
    assert.ok(panda.public.legacy_slugs.length >= 1);
    assert.ok(panda.public.names.every((name) => name.source_ids.length >= 1));
    assert.ok(panda.public.aliases.every((alias) => alias.source_ids.length >= 1));
    assert.ok(
      panda.public.external_identifiers.every(
        (identifier) => identifier.source_ids.length >= 1,
      ),
    );
    assert.ok(
      panda.public.legacy_slugs.every((legacySlug) => legacySlug.source_ids.length >= 1),
    );
    assert.ok(panda.restricted.curator_notes.length >= 1);
  }
});

function errorCodes(report) {
  return new Set(report.errors.map((error) => error.code));
}

test("golden dataset covers the required domain cases", async () => {
  const dataset = await loadGoldenDataset();
  const anchorIds = new Map(
    dataset.pandas.map((record) => [record.public.canonical_slug, record.id]),
  );

  for (const slug of ["mei-xiang", "tian-tian"]) {
    const pandaId = anchorIds.get(slug);
    const panda = dataset.pandas.find((record) => record.id === pandaId);
    assert.deepEqual(
      new Set(panda.public.content.map((content) => content.locale)),
      new Set(["zh-CN", "en"]),
    );
    assert.ok(dataset.facts.filter((fact) => fact.public.subject_id === pandaId).length >= 2);
    assert.ok(dataset.residencies.filter((residency) => residency.public.panda_id === pandaId).length >= 2);
    assert.ok(dataset.events.some((event) => event.public.participants.includes(pandaId)));
    assert.ok(dataset.media.some((media) => media.public.panda_id === pandaId));
  }

  assert.deepEqual(
    new Set(dataset.parentage_assertions.map((assertion) => assertion.public.status)),
    new Set(["confirmed", "tentative"]),
  );
  assert.ok(dataset.facts.every((fact) => fact.public.freshness));
  assert.deepEqual(
    new Set(dataset.media.map((media) => media.public.license_state)),
    new Set(["no_licensed_media", "source_link_only"]),
  );
  assert.ok(dataset.events.some((event) => event.public.event_status === "announced"));
  assert.ok(dataset.events.some((event) => event.public.event_status === "completed"));
});

test("every core profile declares completeness gaps and current-place verification", async () => {
  const dataset = await loadGoldenDataset();

  for (const panda of dataset.pandas) {
    if (panda.public.record_tier !== "complete_first_pass") {
      assert.ok(
        panda.restricted.missing_requirements?.length > 0,
        `${panda.public.canonical_slug} must declare missing archive requirements`,
      );
    }

    const currentResidency = dataset.residencies
      .filter((residency) => residency.public.panda_id === panda.id)
      .filter((residency) => residency.public.residency_type === "primary")
      .find((residency) => residency.public.end_date == null);
    assert.ok(currentResidency, `${panda.public.canonical_slug} needs a current residency`);
    assert.match(currentResidency.public.last_verified_at, /^\d{4}-\d{2}-\d{2}$/);
  }

  for (const assertion of dataset.parentage_assertions) {
    if (assertion.public.status === "confirmed") {
      assert.ok(assertion.public.source_ids.length > 0);
    }
  }
});

test("generated web identity aliases match the current reviewed release", async () => {
  const dataset = await readWebReleaseDataset();
  assert.equal(dataset.dataset.version, WEB_RELEASE_VERSION);
  assert.equal(dataset.pandas.length, 14);
  const generated = await readFile(generatedIdentityAliasesPath, "utf8");

  assert.equal(
    normalizeGeneratedModule(generated),
    normalizeGeneratedModule(renderTrustedIdentityAliasModule(dataset)),
  );
  assert.deepEqual(
    new Set(Object.keys(buildTrustedIdentityReferences(dataset))),
    new Set([
      "bao-bao",
      "bao-li",
      "baobao-smithsonian",
      "baoli",
      "bei-bei",
      "beibei",
      "lei-lei",
      "leilei",
      "lun-lun",
      "lunlun",
      "mei-xiang",
      "mei_xiang",
      "meixiang",
      "ri-ri",
      "riri",
      "shin-shin",
      "shinshin",
      "tai-shan",
      "taishan",
      "tian-tian",
      "tian_tian",
      "tiantian",
      "ya-lun",
      "yalun",
      "yang-yang",
      "yangyang",
      "xiao-qi-ji",
      "xiao-xiao",
      "xiao_qi_ji",
      "xiaoqiji",
      "xiaoxiao",
    ]),
  );
  assert.match(generated, /"meixiang"/);
  assert.match(generated, /"mei-xiang"/);
  assert.match(generated, /TRUSTED_PANDA_DETAILS/);
  assert.match(generated, /TRUSTED_INSTITUTIONS/);
  assert.match(generated, /TRUSTED_PLACES/);
  assert.match(generated, /TRUSTED_FACILITIES/);
  assert.match(generated, /TRUSTED_PARENTAGE_ASSERTIONS/);
  assert.match(generated, /2939c16f-1938-5629-928c-b36b1d5cd6ed/);
  const details = buildTrustedPandaDetails(dataset);
  assert.equal(details.length, 14);
  const lunLun = details.find((detail) => detail.slug === "lun-lun");
  const yangYang = details.find((detail) => detail.slug === "yang-yang");
  const yaLun = details.find((detail) => detail.slug === "ya-lun");
  const uenoFamily = ["ri-ri", "shin-shin", "xiao-xiao", "lei-lei"].map((slug) =>
    details.find((detail) => detail.slug === slug),
  );
  for (const detail of [lunLun, yangYang, yaLun]) {
    assert.ok(detail);
    assert.equal(detail.public_revision.data_version, WEB_RELEASE_VERSION);
    assert.equal(detail.current_place.last_verified_at, "2026-07-20");
    assert.ok(detail.events.length >= 3);
    assert.equal(detail.media.length, 1);
    assert.equal(detail.media[0].status, "available");
    assert.match(detail.cover_image_url, /\/media\/releases\/2026\.07\.20\.1\/.*-w1200\.webp$/);
    assert.equal(detail.media_release.license_state, "licensed");
    assert.equal(detail.media_release.display_mode, "gallery");
  }
  for (const detail of uenoFamily) {
    assert.ok(detail);
    assert.equal(detail.public_revision.data_version, WEB_RELEASE_VERSION);
    assert.match(detail.current_place.last_verified_at, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(detail.events.length >= 3);
    assert.equal(detail.media.length, 1);
    assert.equal(detail.media[0].status, "available");
    assert.match(detail.cover_image_url, /\/media\/releases\/2026\.07\.20\.2\/.*-w1200\.webp$/);
  }
  assert.equal(yaLun.mother_id, lunLun.id);
  assert.equal(yaLun.father_id, yangYang.id);
  assert.ok(yaLun.sources.some((source) => source.id === "src_commons_ya_lun_photo"));

  const facilities = buildTrustedFacilities(dataset);
  assert.equal(
    facilities.find((facility) => facility.id === "89f620b2-37d0-51ba-aafa-6844404a5b2c")
      ?.names.find((name) => name.language === "zh-Hans")?.value,
    "中国大熊猫保护研究中心卧龙神树坪基地",
  );
  const institutions = buildTrustedInstitutions(dataset);
  assert.equal(institutions.length, 5);
  assert.ok(institutions.some((institution) => institution.id === "institution-ueno-zoo"));
  assert.deepEqual(
    institutions.find((institution) => institution.id === "institution-ccrcgp")?.place_ids,
    [
      "place-ccrcgp-bifengxia-base",
      "place-ccrcgp-yaan-base",
      "place-wolong-shenshuping-base",
    ],
  );
  const places = buildTrustedPlaces(dataset);
  assert.equal(places.length, 7);
  assert.ok(places.some((place) => place.id === "place-ueno-zoo"));
  assert.equal(
    places.find((place) => place.id === "place-wolong-shenshuping-base")?.precision,
    "locality",
  );
  assert.ok(places.every((place) => place.source_ids.length > 0));
  const assertions = buildPublishedParentageAssertions(dataset);
  assert.equal(
    assertions.find((assertion) => assertion.id === "parent-bao-li-father")?.status,
    "tentative",
  );
  assert.match(generated, /"profile_available": false/);
  assert.doesNotMatch(
    generated,
    /curator_notes|pending_content|content_hash|review_owner|restricted_excerpt/,
  );
});

test("all test layers load one fixture and the public projection strips restricted data", async () => {
  const fixtures = await Promise.all(
    GOLDEN_DATASET_CONSUMERS.map((consumer) => loadGoldenDataset({ consumer })),
  );
  const identityLists = fixtures.map((dataset) => dataset.pandas.map((record) => record.id));

  for (const dataset of fixtures) {
    assert.equal(dataset.dataset.version, "2026.07.18.1");
    assert.deepEqual(dataset.pandas.map((record) => record.id), identityLists[0]);
  }

  const projection = buildPublicProjection(fixtures[0]);
  assert.equal(projection.dataset.version, "2026.07.18.1");
  assert.equal(projection.pandas.length, 7);
  assert.equal(JSON.stringify(projection).includes("restricted"), false);
  assert.equal(JSON.stringify(projection).includes("curator_notes"), false);
  assert.equal(JSON.stringify(projection).includes("待審核翻譯草稿"), false);
});

test("validation reports missing sources and invalid references", async () => {
  const missingSource = await loadGoldenDataset();
  missingSource.facts[0].public.source_ids = ["src_missing"];
  assert.ok(errorCodes(validateGoldenDataset(missingSource)).has("missing_source"));

  const invalidReference = await loadGoldenDataset();
  invalidReference.residencies[0].public.panda_id = "panda_missing";
  assert.ok(errorCodes(validateGoldenDataset(invalidReference)).has("invalid_reference"));
});

test("validation reports overlapping primary residencies", async () => {
  const dataset = await loadGoldenDataset();
  dataset.residencies.push({
    id: "res-mei-xiang-overlap",
    publication_status: "published",
    public: {
      panda_id: dataset.pandas[0].id,
      facility_id: dataset.facilities[0].id,
      residency_type: "primary",
      start_date: "2023-01-01",
      end_date: "2024-01-01",
      status: "confirmed",
      source_ids: [dataset.sources[0].id],
    },
    restricted: { curator_notes: "Mutation fixture." },
  });

  assert.ok(errorCodes(validateGoldenDataset(dataset)).has("overlapping_residency"));
});

test("validation reports public records that depend on unpublished objects", async () => {
  const dataset = await loadGoldenDataset();
  dataset.facilities[0].publication_status = "draft";

  assert.ok(errorCodes(validateGoldenDataset(dataset)).has("unpublished_dependency"));
});
