import nextWorker from "../.open-next/worker.js";
import publishedPhotoKeys from "./published-photo-keys.json" with { type: "json" };
export { DOQueueHandler, DOShardedTagCache } from "../.open-next/worker.js";

// Only the approved playlist and photo manifest are public. The bucket remains private.
const homeVideos = new Set([
  "wTVtbr-R4yA.webm", "ebcCgSRobc4.webm", "f9KVNw799aE.webm",
  "pgxIO6nyZEY.webm", "s-lxbWhtq40.webm", "pNff91GIIUg.webm",
  "CNnEP98dul4.mp4", "l10zoaT-Q04.webm", "wKR67WFrlj8.webm",
]);
const publicPhotos = new Set(publishedPhotoKeys);

const worker = {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const isPhoto = url.pathname.startsWith("/media/pandas/photos/");
    if (!isPhoto && !url.pathname.startsWith("/media/home-official/")) return nextWorker.fetch(request, env, context);
    const key = url.pathname.slice("/media/".length);
    if (isPhoto ? !publicPhotos.has(key) : !homeVideos.has(key.slice("home-official/".length))) return new Response("Not found", { status: 404 });
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const object = request.method === "HEAD"
      ? await env.HOME_MEDIA.head(key)
      : await env.HOME_MEDIA.get(key, { range: request.headers });
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", isPhoto ? "public, max-age=31536000, immutable" : "public, max-age=3600");
    if (request.headers.get("If-None-Match") === object.httpEtag) {
      if ("body" in object) await object.body.cancel();
      return new Response(null, { status: 304, headers });
    }
    const range = object.range;
    const partial = request.method === "GET" && request.headers.has("Range")
      && range && "offset" in range && range.length !== undefined;
    headers.set("Content-Length", String(partial ? range.length : object.size));
    if (partial) headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    return new Response(request.method === "HEAD" ? null : object.body, { status: partial ? 206 : 200, headers });
  },
};
export default worker;
