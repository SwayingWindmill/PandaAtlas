import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

async function source(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

test("Public Schema 1.2 binds one reviewed media identity across archive, API, snapshots, and D1", async () => {
  const [projection, schema, hardGates, workerPandas, workerReleases] = await Promise.all([
    source("services/api/app/projection/public_release.py"),
    source("services/api/app/schemas/panda.py"),
    source("contracts/beta-hard-gates.v1.json"),
    source("services/worker-api/src/repositories/pandas.ts"),
    source("services/worker-api/src/repositories/releases.ts"),
  ]);

  assert.match(projection, /SUPPORTED_PUBLIC_SCHEMA_VERSIONS = \{[^}]*"1\.2\.0"/);
  assert.match(projection, /def _validated_public_media\(/);
  assert.match(projection, /def _attach_public_media\(/);
  assert.match(projection, /def _bind_runtime_media\(/);
  assert.match(projection, /payload\["media"\]/);
  assert.match(projection, /"media": expected_media/);
  assert.match(projection, /Public media .* cannot expose an image URL while/);
  assert.match(schema, /class MediaDerivative/);
  assert.match(schema, /status: str = Field\(default="unavailable"/);
  assert.match(workerPandas, /lowered\.startsWith\("https:\/\/"\)/);
  assert.doesNotMatch(workerPandas, /lowered\.startsWith\("http:\/\/"\)/);
  assert.match(workerReleases, /"1\.0\.0", "1\.1\.0", "1\.2\.0"/);

  const contract = JSON.parse(hardGates);
  for (const key of [
    "alt_en",
    "alt_zh",
    "bytes",
    "credit",
    "derivatives",
    "height",
    "mime_type",
    "rights",
    "sha256",
    "source_url",
    "width",
  ]) {
    assert.ok(contract.allowed_public_keys.includes(key), `${key} is missing from the public allowlist`);
  }
});

test("trusted profile renders release-owned media with explicit failure and withdrawal states", async () => {
  const [viewModel, gallery, page] = await Promise.all([
    source("apps/web/features/profile/profile-page-view-model.ts"),
    source("apps/web/features/profile/trusted-profile-media-gallery.tsx"),
    source("apps/web/features/profile/trusted-profile-page.tsx"),
  ]);

  assert.match(viewModel, /httpsUrl\(item\.url\)/);
  assert.match(viewModel, /httpsUrl\(item\.signed_url\)/);
  assert.match(viewModel, /item\.status === "available"/);
  assert.match(viewModel, /item\.alt_zh \?\? item\.alt_en/);
  assert.doesNotMatch(viewModel, /panda\.(?:slug|name_zh|name_en).*\.(?:jpg|jpeg|png|webp)/i);

  assert.match(gallery, /onError=\{\(\) => setLoadFailed\(true\)\}/);
  assert.match(gallery, /data-testid="media-load-error"|"media-load-error"/);
  assert.match(gallery, /data-testid="media-withdrawn-state"|"media-withdrawn-state"/);
  assert.match(gallery, /item\.sourceUrl/);
  assert.match(gallery, /item\.rights/);
  assert.match(gallery, /item\.credit/);
  assert.match(gallery, /No other panda or generic image is substituted/);
  assert.doesNotMatch(gallery, /fallback(?:Image|Url)|placeholder\.(?:jpg|png|webp)/i);

  assert.match(page, /TrustedProfileMediaGallery/);
  assert.match(page, /profile\.media\.state === "gallery"/);
});
