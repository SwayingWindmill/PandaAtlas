import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runBetaHardGatePreflight } from "../check-beta-hard-gates.mjs";
import { assertReviewedMediaArchive } from "../media-integrity.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const contract = JSON.parse(
  await readFile(path.join(repoRoot, "contracts/beta-hard-gates.v1.json"), "utf8"),
);
const uenoDataset = JSON.parse(
  await readFile(
    path.join(repoRoot, "data/reviewed-batches/2026.07.20.2/source.json"),
    "utf8",
  ),
);
const uenoApi = JSON.parse(
  await readFile(path.join(repoRoot, "data/public-releases/2026.07.20.2/api.json"), "utf8"),
);

function clone(value) {
  return structuredClone(value);
}

function availableMedia(dataset) {
  return dataset.media.find((item) => item.public.status === "available");
}

function expansionMedia(dataset) {
  const expansionIds = new Set(dataset.dataset.expansion_panda_ids);
  return dataset.media.find(
    (item) =>
      item.public.status === "available" && expansionIds.has(item.public.panda_id),
  );
}

function profileFor(api, media) {
  return api.pandas.find((item) => item.id === media.public.panda_id);
}

function cloneAvailableMedia(dataset, sourceMedia) {
  const copy = clone(sourceMedia);
  const replacementSuffix = "1111111111111111";
  copy.id = sourceMedia.id.replace(/[a-f0-9]{16}$/, replacementSuffix);
  assert.notEqual(copy.id, sourceMedia.id);
  for (const derivative of copy.public.derivatives) {
    derivative.url = derivative.url.replace(sourceMedia.id, copy.id);
  }
  copy.public.url = copy.public.url.replace(sourceMedia.id, copy.id);
  dataset.media.push(copy);
  return copy;
}

function withdrawMedia(media, status = "withdrawn") {
  media.public.status = status;
  for (const field of [
    "url",
    "derivatives",
    "mime_type",
    "width",
    "height",
    "bytes",
    "sha256",
  ]) {
    delete media.public[field];
  }
}

function projectedMedia(media) {
  return { id: media.id, ...clone(media.public) };
}

for (const fixture of [
  {
    name: "golden seven-panda release",
    dataset: "contracts/golden-dataset/mei-xiang-family.v1.json",
    api: "data/public-releases/2026.07.18.1/api.json",
  },
  {
    name: "Atlanta photo expansion",
    dataset: "data/reviewed-batches/2026.07.20.1/source.json",
    api: "data/public-releases/2026.07.20.1/api.json",
  },
  {
    name: "Ueno photo expansion with inherited Atlanta media",
    dataset: "data/reviewed-batches/2026.07.20.2/source.json",
    api: "data/public-releases/2026.07.20.2/api.json",
  },
]) {
  test(`${fixture.name} satisfies the same immutable media contract`, async () => {
    const dataset = JSON.parse(await readFile(path.join(repoRoot, fixture.dataset), "utf8"));
    const api = JSON.parse(await readFile(path.join(repoRoot, fixture.api), "utf8"));
    assert.doesNotThrow(() => assertReviewedMediaArchive(dataset, contract, api));
  });
}

test("a later release may retain media from any tracked reviewed ancestor", () => {
  const dataset = clone(uenoDataset);
  const api = clone(uenoApi);
  dataset.dataset.version = "2026.07.20.3";
  dataset.dataset.base_dataset_version = "2026.07.20.2";
  const trackedVersions = new Set([
    "2026.07.18.1",
    "2026.07.20.1",
    "2026.07.20.2",
    "2026.07.20.3",
  ]);

  assert.doesNotThrow(() =>
    assertReviewedMediaArchive(dataset, contract, api, trackedVersions),
  );
});

const negativeCases = [
  {
    name: "missing rights",
    mutate(dataset) {
      availableMedia(dataset).public.rights = "";
    },
    error: /lun-lun media media-lun-lun-.* requires rights/,
  },
  {
    name: "unclear rights",
    mutate(dataset) {
      availableMedia(dataset).public.rights = "unknown";
    },
    error: /lun-lun media media-lun-lun-.* rights are unknown or unclear/,
  },
  {
    name: "missing credit",
    mutate(dataset) {
      availableMedia(dataset).public.credit = "";
    },
    error: /lun-lun media media-lun-lun-.* requires credit/,
  },
  {
    name: "missing Chinese alt",
    mutate(dataset) {
      availableMedia(dataset).public.alt_zh = "";
    },
    error: /lun-lun media media-lun-lun-.* requires alt_zh/,
  },
  {
    name: "missing English alt",
    mutate(dataset) {
      availableMedia(dataset).public.alt_en = "";
    },
    error: /lun-lun media media-lun-lun-.* requires alt_en/,
  },
  {
    name: "non-HTTPS source URL",
    mutate(dataset) {
      availableMedia(dataset).public.source_url = "http://example.test/photo";
    },
    error: /lun-lun media media-lun-lun-.* source_url must use HTTPS/,
  },
  {
    name: "missing source IDs",
    mutate(dataset) {
      availableMedia(dataset).public.source_ids = [];
    },
    error: /lun-lun media media-lun-lun-.* requires source_ids/,
  },
  {
    name: "missing source record",
    mutate(dataset) {
      availableMedia(dataset).public.source_ids = ["src_missing_photo_rights"];
    },
    error: /lun-lun media media-lun-lun-.* references a missing source/,
  },
  {
    name: "unreviewed source record",
    mutate(dataset) {
      const media = availableMedia(dataset);
      dataset.sources.find((source) => source.id === media.public.source_ids[0]).public.access_state = "unavailable";
    },
    error: /lun-lun media media-lun-lun-.* source .* is not reviewed and accessible/,
  },
  {
    name: "orphan panda reference",
    mutate(dataset) {
      availableMedia(dataset).public.panda_id = "missing-panda-id";
    },
    error: /missing-panda-id media media-lun-lun-.* references unpublished or missing panda/,
  },
  {
    name: "non-system media ID",
    mutate(dataset) {
      availableMedia(dataset).id = "media-handwritten";
    },
    error: /media-handwritten media ID is not system-generated/,
  },
  {
    name: "mutable or foreign media URL",
    mutate(dataset) {
      availableMedia(dataset).public.url = "https://images.example.test/lun-lun.webp";
    },
    error: /url is not an immutable release media URL/,
  },
  {
    name: "unreviewed release URL",
    mutate(dataset) {
      const media = availableMedia(dataset);
      media.public.url = media.public.url.replace("2026.07.20.1", "2026.07.19.9");
    },
    error: /url release 2026\.07\.19\.9 is not a tracked reviewed Public Release/,
  },
  {
    name: "non-WebP primary MIME",
    mutate(dataset) {
      availableMedia(dataset).public.mime_type = "image/jpeg";
    },
    error: /mime_type must be image\/webp/,
  },
  {
    name: "zero primary bytes",
    mutate(dataset) {
      availableMedia(dataset).public.bytes = 0;
    },
    error: /requires positive integer bytes/,
  },
  {
    name: "invalid primary hash",
    mutate(dataset) {
      availableMedia(dataset).public.sha256 = "not-a-hash";
    },
    error: /sha256 must be a 64-character hexadecimal digest/,
  },
  {
    name: "missing required derivative",
    mutate(dataset) {
      const media = availableMedia(dataset);
      media.public.derivatives = media.public.derivatives.filter(
        (item) => item.kind !== "width-480",
      );
    },
    error: /requires WebP derivatives/,
  },
  {
    name: "zero derivative bytes",
    mutate(dataset) {
      availableMedia(dataset).public.derivatives[0].bytes = 0;
    },
    error: /derivative width-480 requires positive integer bytes/,
  },
  {
    name: "invalid derivative hash",
    mutate(dataset) {
      availableMedia(dataset).public.derivatives[0].sha256 = "not-a-hash";
    },
    error: /derivative width-480 width-480 sha256 must be a 64-character hexadecimal digest/,
  },
  {
    name: "multiple primary derivatives",
    mutate(dataset) {
      const media = availableMedia(dataset);
      const primary = media.public.derivatives.find((item) => item.kind === "width-1200");
      media.public.derivatives.push(clone(primary));
    },
    error: /duplicate derivative kind width-1200/,
  },
  {
    name: "duplicate derivative kind",
    mutate(dataset) {
      const media = availableMedia(dataset);
      media.public.derivatives.push(clone(media.public.derivatives[0]));
    },
    error: /duplicate derivative kind width-480/,
  },
  {
    name: "derivative width drift",
    mutate(dataset) {
      availableMedia(dataset).public.derivatives[0].width = 481;
    },
    error: /width-480 width drifted: expected 480; got 481/,
  },
  {
    name: "derivative MIME drift",
    mutate(dataset) {
      availableMedia(dataset).public.derivatives[0].mime_type = "image/png";
    },
    error: /width-480 mime_type must be image\/webp/,
  },
  {
    name: "derivative URL release drift",
    mutate(dataset) {
      const derivative = availableMedia(dataset).public.derivatives[0];
      derivative.url = derivative.url.replace("2026.07.20.1", "2026.07.20.2");
    },
    error: /width-480 url drifted/,
  },
  {
    name: "primary byte count drift",
    mutate(dataset) {
      availableMedia(dataset).public.bytes += 1;
    },
    error: /primary bytes must equal width-1200 derivative bytes/,
  },
  {
    name: "API media set drift",
    mutate(dataset, api) {
      profileFor(api, availableMedia(dataset)).media = [];
    },
    error: /api\.json available media set drifted/,
  },
  {
    name: "API media field drift",
    mutate(dataset, api) {
      profileFor(api, availableMedia(dataset)).media[0].credit = "Wrong credit";
    },
    error: /api\.json credit drifted/,
  },
  {
    name: "cover image does not select available media",
    mutate(dataset, api) {
      profileFor(api, availableMedia(dataset)).cover_image_url = "https://api.zhipanda.com/media/releases/2026.07.20.2/not-this-media-w1200.webp";
    },
    error: /cover_image_url must select exactly one available reviewed media record/,
  },
  {
    name: "media release source drift",
    mutate(dataset, api) {
      profileFor(api, availableMedia(dataset)).media_release.source_ids = [];
    },
    error: /media_release source_ids drifted/,
  },
  {
    name: "legacy empty state exposes an image URL",
    mutate(dataset) {
      dataset.media.find((item) => item.public.display_mode === "designed_empty_state").public.url = "https://example.test/not-licensed.webp";
    },
    error: /cannot expose url/,
  },
  {
    name: "legacy source link loses its reviewed source",
    mutate(dataset) {
      dataset.media.find((item) => item.public.display_mode === "link_to_source").public.source_ids = [];
    },
    error: /requires source_ids/,
  },
];

for (const fixture of negativeCases) {
  test(`media gate rejects ${fixture.name}`, () => {
    const dataset = clone(uenoDataset);
    const api = clone(uenoApi);
    fixture.mutate(dataset, api);
    assert.throws(
      () => assertReviewedMediaArchive(dataset, contract, api),
      fixture.error,
    );
  });
}

test("withdrawn media retains audited human metadata but exposes no image payload", () => {
  const dataset = clone(uenoDataset);
  const api = clone(uenoApi);
  const original = expansionMedia(dataset);
  const replacement = cloneAvailableMedia(dataset, original);
  withdrawMedia(original);

  const profile = profileFor(api, original);
  profile.media = [projectedMedia(replacement)];
  profile.cover_image_url = replacement.public.url;

  assert.doesNotThrow(() => assertReviewedMediaArchive(dataset, contract, api));
});

test("withdrawn media with a public URL fails before projection", () => {
  const dataset = clone(uenoDataset);
  const media = expansionMedia(dataset);
  media.public.status = "withdrawn";
  assert.throws(
    () => assertReviewedMediaArchive(dataset, contract),
    new RegExp(`${media.id} cannot expose url`),
  );
});

test("withdrawn media cannot satisfy the expansion minimum-photo gate", () => {
  const dataset = clone(uenoDataset);
  const media = expansionMedia(dataset);
  const panda = dataset.pandas.find((item) => item.id === media.public.panda_id);
  withdrawMedia(media);
  assert.throws(
    () => assertReviewedMediaArchive(dataset, contract),
    new RegExp(`${panda.public.canonical_slug} requires at least one available reviewed photo; found 0`),
  );
});

test("withdrawn media must retain rights and attribution history", () => {
  const dataset = clone(uenoDataset);
  const media = expansionMedia(dataset);
  const replacement = cloneAvailableMedia(dataset, media);
  withdrawMedia(media);
  media.public.rights = "";
  assert.ok(replacement);
  assert.throws(
    () => assertReviewedMediaArchive(dataset, contract),
    new RegExp(`${media.id} requires rights`),
  );
});

test("unavailable media cannot retain derivative payloads", () => {
  const dataset = clone(uenoDataset);
  const media = expansionMedia(dataset);
  const replacement = cloneAvailableMedia(dataset, media);
  media.public.status = "unavailable";
  assert.ok(replacement);
  assert.throws(
    () => assertReviewedMediaArchive(dataset, contract),
    new RegExp(`${media.id} cannot expose url`),
  );
});

test("a licensed photo cannot allow a partial expansion profile through the trusted archive gate", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "panda-media-tier-"));
  try {
    const dataset = clone(uenoDataset);
    const pandaId = dataset.dataset.expansion_panda_ids[0];
    const panda = dataset.pandas.find((item) => item.id === pandaId);
    panda.public.record_tier = "partial";
    const datasetPath = path.join(directory, "source.json");
    const reportPath = path.join(directory, "report.json");
    await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

    const result = await runBetaHardGatePreflight({
      root: repoRoot,
      report: reportPath,
      dataset: datasetPath,
    });
    const trusted = result.checks.find((item) => item.id === "trusted-archive");
    assert.equal(result.outcome, "failed");
    assert.equal(trusted?.status, "failed");
    assert.match(
      trusted?.detail ?? "",
      new RegExp(`${panda.public.canonical_slug} must remain complete_first_pass; got partial`),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the Beta hard-gate report locates panda, media, and missing field", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "panda-media-report-"));
  try {
    const dataset = clone(uenoDataset);
    const media = expansionMedia(dataset);
    const panda = dataset.pandas.find((item) => item.id === media.public.panda_id);
    media.public.alt_en = "";
    const datasetPath = path.join(directory, "source.json");
    const reportPath = path.join(directory, "report.json");
    await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

    const result = await runBetaHardGatePreflight({
      root: repoRoot,
      report: reportPath,
      dataset: datasetPath,
    });
    const persisted = JSON.parse(await readFile(reportPath, "utf8"));
    const trusted = persisted.checks.find((item) => item.id === "trusted-archive");
    assert.equal(result.outcome, "failed");
    assert.equal(trusted?.status, "failed");
    assert.match(
      trusted?.detail ?? "",
      new RegExp(`${panda.public.canonical_slug} media ${media.id} requires alt_en`),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
