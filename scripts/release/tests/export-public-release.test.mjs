import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ExportError, exportPublicRelease } from "../export-public-release.mjs";

const release = { releaseId: "r-1", version: "2026.11.03.1" };

/** A public API serving one release; `switchAfter` requests later it starts answering for another. */
function fakeApi({ switchAfter = Infinity } = {}) {
  const requested = [];
  const fetchJson = async (url) => {
    const route = new URL(url).pathname;
    requested.push(route);
    const current = requested.length > switchAfter ? { releaseId: "r-2", version: "2026.11.03.2" } : release;
    if (route === "/api/v2/release") return release;
    if (route === "/api/v2/pandas") return { release: current, items: [{ canonicalSlug: "a-bao" }, { canonicalSlug: "mei-xiang" }] };
    if (route === "/api/v2/places" || route === "/api/v2/institutions") return { release: current, items: [{ slug: "zoo-atlanta" }] };
    if (route === "/api/v2/stats") return { pandas: 2 };
    if (/^\/api\/v2\/(pandas|places|institutions)\/[^/]+$/.test(route)) return { release: current, slug: route.split("/").at(-1) };
    return { release: current, items: [] };
  };
  return { fetchJson, requested };
}

test("exports every list and detail of the active release with checksums", async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), "release-export-"));
  try {
    const { fetchJson, requested } = fakeApi();
    const { manifest, target } = await exportPublicRelease({
      base: "https://api.example.test", outDir, fetchJson, now: () => new Date("2026-11-03T00:00:00Z"),
    });
    assert.equal(target, path.join(outDir, "2026.11.03.1"));
    assert.ok(requested.includes("/api/v2/pandas/mei-xiang"));
    assert.deepEqual(Object.keys(manifest.files).sort(), [
      "institution-details.jsonl", "institutions.json", "learning.json", "life-events.json", "lineage.json",
      "panda-details.jsonl", "pandas.json", "place-details.jsonl", "places.json", "residencies.json", "stats.json",
    ]);
    assert.equal(manifest.files["panda-details.jsonl"].count, 2);
    const details = await readFile(path.join(target, "panda-details.jsonl"), "utf8");
    assert.deepEqual(details.trim().split("\n").map((line) => JSON.parse(line).slug), ["a-bao", "mei-xiang"]);
    // Every line of SHA256SUMS matches the file it names.
    const sums = (await readFile(path.join(target, "SHA256SUMS"), "utf8")).trim().split("\n");
    assert.equal(sums.length, 12);
    for (const line of sums) {
      const [hash, name] = line.split("  ");
      assert.equal(createHash("sha256").update(await readFile(path.join(target, name))).digest("hex"), hash, name);
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("fails when the active release changes during the export", async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), "release-export-"));
  try {
    const { fetchJson } = fakeApi({ switchAfter: 4 });
    await assert.rejects(exportPublicRelease({ base: "https://api.example.test", outDir, fetchJson }), ExportError);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
