import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Slice 8 keeps institution and place as independent public entities", async () => {
  const [types, publicRelease, institutionRoute, placeRoute, institutionModel, placeModel] = await Promise.all([
    source("apps/web/lib/types.ts"),
    source("apps/web/features/public-content/public-release.ts"),
    source("apps/web/app/[locale]/institutions/[slug]/page.tsx"),
    source("apps/web/app/[locale]/places/[slug]/page.tsx"),
    source("apps/web/features/institutions/institution-page-view-model.ts"),
    source("apps/web/features/places/place-page-view-model.ts"),
  ]);

  assert.match(types, /interface PublicInstitutionSummary/);
  assert.match(types, /interface PublicPlaceSummary/);
  assert.match(types, /precision: "locality" \| "country"/);
  const placeType = types.slice(
    types.indexOf("export interface PublicPlaceSummary"),
    types.indexOf("/** Compatibility alias"),
  );
  assert.doesNotMatch(placeType, /coordinates:/);

  assert.match(publicRelease, /TRUSTED_INSTITUTIONS/);
  assert.match(publicRelease, /TRUSTED_PLACES/);
  assert.match(publicRelease, /resolvePublishedInstitutionReference/);
  assert.match(publicRelease, /resolvePublishedPlaceReference/);

  assert.match(institutionRoute, /buildInstitutionPageViewModel/);
  assert.doesNotMatch(institutionRoute, /buildPlacePageViewModel/);
  assert.match(placeRoute, /buildPlacePageViewModel/);
  assert.doesNotMatch(placeRoute, /buildInstitutionPageViewModel/);

  assert.match(institutionModel, /kind: "institution"/);
  assert.match(institutionModel, /associated places/i);
  assert.match(placeModel, /kind: "place"/);
  assert.match(placeModel, /published location precision/i);
});

test("Slice 8 canonical pages do not publish unsupported compatibility facilities", async () => {
  const [dataset, entitySmoke, atlasPage, mapModel, profileModel] = await Promise.all([
    source("contracts/golden-dataset/mei-xiang-family.v1.json"),
    source("apps/web/tests/smoke/localized-entities.spec.ts"),
    source("apps/web/app/[locale]/atlas/page.tsx"),
    source("apps/web/features/map/map-view-model.ts"),
    source("apps/web/features/profile/profile-page-view-model.ts"),
  ]);

  const contract = JSON.parse(dataset);
  assert.equal(contract.dataset.version, "2026.07.18.1");
  assert.equal(contract.dataset.public_schema_version, "1.1.0");
  assert.equal(contract.institutions.length, 2);
  assert.equal(contract.places.length, 2);
  assert.ok(contract.places.every((place) => place.public.precision !== "exact"));
  assert.ok(contract.places.every((place) => !Object.hasOwn(place.public, "coordinates")));
  assert.ok(
    contract.institutions.every((institution) =>
      !institution.public.facility_ids.includes("60c7e1a3-d286-5366-8d41-32c11df58b5c"),
    ),
  );

  assert.match(entitySmoke, /unsupported compatibility facility/);
  assert.match(entitySmoke, /expect\(response\.status\(\)\)\.toBe\(404\)/);
  assert.match(atlasPage, /institution and physical place|机构和物理场所/);
  assert.match(mapModel, /entityHref/);
  assert.match(profileModel, /entityHref/);
});

test("Slice 8 Worker accepts current and rollback Public Schema versions without duplicate repositories", async () => {
  const [releaseRepository, repositoryEntries] = await Promise.all([
    source("services/worker-api/src/repositories/releases.ts"),
    readdir(new URL("services/worker-api/src/repositories/", root)),
  ]);

  assert.match(
    releaseRepository,
    /SUPPORTED_PUBLIC_SCHEMA_VERSIONS = new Set\(\["1\.0\.0", "1\.1\.0"\]\)/,
  );
  assert.doesNotMatch(releaseRepository, /public_schema_version !== "1\.0\.0"/);
  assert.deepEqual(
    repositoryEntries.filter((entry) => /^releases \(\d+\)\.ts$/.test(entry)),
    [],
  );
});
