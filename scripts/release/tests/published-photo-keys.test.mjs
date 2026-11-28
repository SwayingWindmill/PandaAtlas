import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_PHOTO_KEYS_PATH,
  PublishedPhotoKeysError,
  diffPhotoKeys,
  extractPhotoKeysFromExport,
  fetchPhotoKeysFromApi,
  formatPublishedPhotoKeys,
  normalizePublishedPhotoKeys,
  runCli,
  validatePublishedPhotoKeysText,
} from "../published-photo-keys.mjs";

const KEY_A = `pandas/photos/${"a".repeat(64)}.webp`;
const KEY_B = `pandas/photos/${"b".repeat(64)}.webp`;
const KEY_C = `pandas/photos/${"c".repeat(64)}.webp`;

test("committed published-photo-keys.json passes strict canonical validation", async () => {
  const raw = await readFile(DEFAULT_PHOTO_KEYS_PATH, "utf8");
  const keys = validatePublishedPhotoKeysText(raw);
  assert.ok(keys.length >= 1400);
});

test("normalizePublishedPhotoKeys deduplicates, sorts lexicographically, and rejects invalid keys", () => {
  assert.deepEqual(normalizePublishedPhotoKeys([KEY_B, KEY_A, KEY_B]), [KEY_A, KEY_B]);
  assert.throws(() => normalizePublishedPhotoKeys(["pandas/photos/not-a-sha.webp"]), PublishedPhotoKeysError);
  assert.throws(() => validatePublishedPhotoKeysText(JSON.stringify([KEY_B, KEY_A], null, 2)), PublishedPhotoKeysError);
  assert.throws(() => validatePublishedPhotoKeysText(JSON.stringify([KEY_A, KEY_A], null, 2)), PublishedPhotoKeysError);
});

test("extractPhotoKeysFromExport extracts photo keys, ignores external links, and detects then repairs drift", async () => {
  const workDir = await mkdtemp(path.join(tmpdir(), "photo-keys-"));
  try {
    const jsonl = [
      JSON.stringify({
        panda: { pandaId: "1" },
        media: [
          { objectKey: KEY_B },
          { objectKey: "https://example.com/external.jpg" },
          { objectKey: KEY_A },
        ],
      }),
      JSON.stringify({
        panda: { pandaId: "2" },
        media: [{ objectKey: KEY_B }, { objectKey: KEY_C }],
      }),
    ].join("\n");
    await writeFile(path.join(workDir, "panda-details.jsonl"), `${jsonl}\n`, "utf8");

    const extracted = await extractPhotoKeysFromExport(workDir);
    assert.deepEqual(extracted, [KEY_A, KEY_B, KEY_C]);

    const manifestPath = path.join(workDir, "published-photo-keys.json");
    await writeFile(manifestPath, formatPublishedPhotoKeys([KEY_A]), "utf8");

    assert.deepEqual(diffPhotoKeys([KEY_A], extracted), { added: [KEY_B, KEY_C], removed: [] });
    await assert.rejects(
      runCli(["--check", "--from-export", workDir, "--file", manifestPath]),
      PublishedPhotoKeysError,
    );

    await runCli(["--write", "--from-export", workDir, "--file", manifestPath]);
    const verified = await runCli(["--check", "--from-export", workDir, "--file", manifestPath]);
    assert.equal(verified.count, 3);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

test("fetchPhotoKeysFromApi collects active release photo keys and rejects mid-run release switches", async () => {
  const release = { releaseId: "r-1", version: "2026.11.20.1" };
  let calls = 0;
  const fetchJson = async (url, switchMidRun = false) => {
    calls += 1;
    const route = new URL(url).pathname;
    if (route === "/api/v2/release") return release;
    if (route === "/api/v2/pandas") return { release, items: [{ canonicalSlug: "bao-li" }, { canonicalSlug: "xi-lun" }] };
    const current = switchMidRun && calls > 3 ? { releaseId: "r-2", version: "2026.11.20.2" } : release;
    if (route === "/api/v2/pandas/bao-li") {
      return { release: current, media: [{ objectKey: KEY_B }, { objectKey: "videos/clip.mp4" }] };
    }
    return { release: current, media: [{ objectKey: KEY_A }] };
  };

  assert.deepEqual(await fetchPhotoKeysFromApi({ base: "https://api.example.test", fetchJson }), [KEY_A, KEY_B]);

  calls = 0;
  await assert.rejects(
    fetchPhotoKeysFromApi({ base: "https://api.example.test", fetchJson: (url) => fetchJson(url, true) }),
    PublishedPhotoKeysError,
  );
});
