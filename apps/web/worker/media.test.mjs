import assert from "node:assert/strict";
import test from "node:test";

import { serveMedia } from "./media.mjs";

const PHOTO_KEY = "pandas/photos/lun-lun/1.webp";
const VIDEO_KEY = "home-official/clip.webm";
const BYTES = new TextEncoder().encode("0123456789");

function fakeBucket() {
  const calls = [];
  const object = (range) => ({
    size: BYTES.length,
    httpEtag: '"etag-1"',
    range,
    body: new Blob([range ? BYTES.slice(range.offset, range.offset + range.length) : BYTES]).stream(),
    writeHttpMetadata(headers) {
      headers.set("Content-Type", "image/webp");
    },
  });
  return {
    calls,
    async get(key, { range }) {
      calls.push(`get:${key}`);
      const header = range.get("Range");
      if (!header) return object(undefined);
      const [, start, end] = /bytes=(\d+)-(\d+)/u.exec(header);
      return object({ offset: Number(start), length: Number(end) - Number(start) + 1 });
    },
    async head(key) {
      calls.push(`head:${key}`);
      const metadata = object(undefined);
      delete metadata.body;
      return metadata;
    },
  };
}

function setup() {
  const bucket = fakeBucket();
  const serve = (path, init) => serveMedia(new Request(`https://zhipanda.com${path}`, init), { HOME_MEDIA: bucket }, {
    photos: new Set([PHOTO_KEY]),
    videos: new Set(["clip.webm"]),
  });
  return { bucket, serve };
}

test("a published photo is immutable so Workers Cache keeps it at the edge", async () => {
  const { bucket, serve } = setup();
  const response = await serve(`/media/${PHOTO_KEY}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "0123456789");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("ETag"), '"etag-1"');
  assert.deepEqual(bucket.calls, [`get:${PHOTO_KEY}`]);
});

test("a matching If-None-Match returns 304", async () => {
  const { serve } = setup();
  const conditional = await serve(`/media/${PHOTO_KEY}`, { headers: { "If-None-Match": '"etag-1"' } });
  assert.equal(conditional.status, 304);
  assert.equal(conditional.headers.get("ETag"), '"etag-1"');
});

test("an unpublished key is 404 and never touches R2", async () => {
  const { bucket, serve } = setup();
  const response = await serve("/media/pandas/photos/unpublished.webp");
  assert.equal(response.status, 404);
  assert.deepEqual(bucket.calls, []);
});

test("range, HEAD and video requests read R2 directly", async () => {
  const { bucket, serve } = setup();

  const partial = await serve(`/media/${PHOTO_KEY}`, { headers: { Range: "bytes=2-5" } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("Content-Range"), "bytes 2-5/10");
  assert.equal(partial.headers.get("Content-Length"), "4");
  assert.equal(await partial.text(), "2345");

  const head = await serve(`/media/${PHOTO_KEY}`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("Content-Length"), "10");

  const video = await serve(`/media/${VIDEO_KEY}`);
  assert.equal(video.status, 200);
  assert.equal(video.headers.get("Cache-Control"), "public, max-age=3600");

  assert.deepEqual(bucket.calls, [`get:${PHOTO_KEY}`, `head:${PHOTO_KEY}`, `get:${VIDEO_KEY}`]);
});

test("unsupported methods on allowlisted media return 405", async () => {
  const { serve } = setup();
  const response = await serve(`/media/${PHOTO_KEY}`, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});
