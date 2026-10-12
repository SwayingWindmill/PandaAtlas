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

// Like the Workers Cache API, every match returns a fresh Response rather than a tee of a stored one.
function fakeCache() {
  const store = new Map();
  const calls = [];
  return {
    calls,
    async match(request) {
      calls.push(`match:${request.url}`);
      const entry = store.get(request.url);
      return entry && new Response(entry.body, { status: entry.status, headers: entry.headers });
    },
    async put(request, response) {
      calls.push(`put:${request.url}`);
      store.set(request.url, {
        body: await response.arrayBuffer(),
        status: response.status,
        headers: [...response.headers],
      });
    },
  };
}

function setup() {
  const bucket = fakeBucket();
  const cache = fakeCache();
  const pending = [];
  const context = { waitUntil: (promise) => pending.push(promise) };
  const serve = async (path, init) => {
    const response = await serveMedia(new Request(`https://zhipanda.com${path}`, init), { HOME_MEDIA: bucket }, context, {
      cache,
      photos: new Set([PHOTO_KEY]),
      videos: new Set(["clip.webm"]),
    });
    await Promise.all(pending.splice(0));
    return response;
  };
  return { bucket, cache, serve };
}

test("a published photo is read from R2 once and then served from the edge cache", async () => {
  const { bucket, cache, serve } = setup();

  const first = await serve(`/media/${PHOTO_KEY}`);
  assert.equal(first.status, 200);
  assert.equal(await first.text(), "0123456789");
  assert.equal(first.headers.get("Cache-Control"), "public, max-age=31536000, immutable");

  const second = await serve(`/media/${PHOTO_KEY}?utm=1`);
  assert.equal(second.status, 200);
  assert.equal(await second.text(), "0123456789");
  assert.deepEqual(bucket.calls, [`get:${PHOTO_KEY}`]);
  assert.deepEqual(cache.calls.filter((call) => call.startsWith("put")), [`put:https://zhipanda.com/media/${PHOTO_KEY}`]);
});

test("a matching If-None-Match on a cached photo returns 304 without reading R2", async () => {
  const { bucket, serve } = setup();
  await serve(`/media/${PHOTO_KEY}`);

  const conditional = await serve(`/media/${PHOTO_KEY}`, { headers: { "If-None-Match": '"etag-1"' } });
  assert.equal(conditional.status, 304);
  assert.equal(conditional.headers.get("ETag"), '"etag-1"');
  assert.equal(bucket.calls.length, 1);
});

test("an unpublished key is 404 and never touches the cache or R2", async () => {
  const { bucket, cache, serve } = setup();
  const response = await serve("/media/pandas/photos/unpublished.webp");
  assert.equal(response.status, 404);
  assert.deepEqual(bucket.calls, []);
  assert.deepEqual(cache.calls, []);
});

test("range, HEAD and video requests bypass the cache with unchanged responses", async () => {
  const { bucket, cache, serve } = setup();

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

  assert.deepEqual(cache.calls, []);
  assert.deepEqual(bucket.calls, [`get:${PHOTO_KEY}`, `head:${PHOTO_KEY}`, `get:${VIDEO_KEY}`]);
});

test("unsupported methods on allowlisted media return 405", async () => {
  const { serve } = setup();
  const response = await serve(`/media/${PHOTO_KEY}`, { method: "POST" });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});
