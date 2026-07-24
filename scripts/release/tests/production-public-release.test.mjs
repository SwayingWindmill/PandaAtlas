import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  collectPublicMedia,
  parseArguments,
  parsePublicMediaUrl,
  repositoryRoot,
} from "../production-public-release.mjs";

const API_BASE = "https://api.zhipanda.com";

function mediaUrl(width) {
  return `${API_BASE}/media/releases/2026.07.24.2/media-test-panda-0123456789abcdef-w${width}.webp`;
}

test("production media contract accepts processed widths from 480 through 1200", () => {
  for (const width of [480, 550, 800, 1080, 1200]) {
    const parsed = parsePublicMediaUrl(mediaUrl(width));
    assert.equal(parsed.width, width);
    assert.equal(parsed.objectKey, `releases/2026.07.24.2/media-test-panda-0123456789abcdef-w${width}.webp`);
  }
});

test("production media contract rejects unsafe origins, paths, and widths", () => {
  assert.throws(() => parsePublicMediaUrl(mediaUrl(479)), /between 480 and 1200/);
  assert.throws(() => parsePublicMediaUrl(mediaUrl(1201)), /between 480 and 1200/);
  assert.throws(
    () => parsePublicMediaUrl("https://example.com/media/releases/2026.07.24.2/media-test-panda-0123456789abcdef-w480.webp"),
    /must use https:\/\/api\.zhipanda\.com/,
  );
  assert.throws(
    () => parsePublicMediaUrl(`${API_BASE}/media/latest/media-test-panda-0123456789abcdef-w480.webp`),
    /not immutable and versioned/,
  );
});

test("public media collection deduplicates the primary URL and enforces integrity", () => {
  const url = mediaUrl(800);
  const payload = {
    pandas: [
      {
        slug: "test-panda",
        media: [
          {
            id: "media-test",
            status: "available",
            url,
            bytes: 42,
            sha256: "a".repeat(64),
            derivatives: [
              { url, bytes: 42, sha256: "a".repeat(64) },
              { url: mediaUrl(480), bytes: 24, sha256: "b".repeat(64) },
            ],
          },
        ],
      },
    ],
  };
  const collected = collectPublicMedia(payload);
  assert.equal(collected.length, 2);
  assert.deepEqual(collected.map((item) => item.width), [480, 800]);

  payload.pandas[0].media[0].derivatives[0].sha256 = "c".repeat(64);
  assert.throws(() => collectPublicMedia(payload), /Conflicting integrity metadata/);
});

test("tracked 2026.07.24.2 API media is compatible with the production route", async () => {
  const api = JSON.parse(
    await readFile(path.join(repositoryRoot, "data", "public-releases", "2026.07.24.2", "api.json"), "utf8"),
  );
  const media = collectPublicMedia(api);
  assert.ok(media.length >= 20);
  assert.ok(media.some((item) => item.width === 550));
  assert.ok(media.some((item) => item.width === 800));
  assert.ok(media.some((item) => item.width === 1080));
  assert.ok(media.every((item) => item.width >= 480 && item.width <= 1200));
});

test("production and rollback-drill arguments are explicit", () => {
  const production = parseArguments(["--release", "2026.07.24.2", "--execute"]);
  assert.equal(production.execute, true);
  assert.equal(production.drill, false);

  const drill = parseArguments([
    "--release",
    "2026.07.24.2",
    "--rollback-target",
    "2026.07.24.1",
    "--drill",
    "--execute",
  ]);
  assert.equal(drill.drill, true);
  assert.equal(drill.rollbackTarget, "2026.07.24.1");
  assert.throws(() => parseArguments(["--release", "2026.07.24.2", "--drill"]), /requires --rollback-target/);
  assert.throws(
    () => parseArguments(["--release", "2026.07.24.2", "--execute", "--skip-gate"]),
    /cannot use --skip-gate/,
  );
});
