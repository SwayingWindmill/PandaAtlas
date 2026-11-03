import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Exports the active public release from the public API into a versioned folder, so the published data
// can be restored or diffed without the production database. Every file is listed with its SHA-256 in
// manifest.json and SHA256SUMS. Procedure: docs/runbooks/production-release.md#back-up-the-published-data

const LISTS = ["pandas", "places", "institutions", "lineage", "residencies", "life-events", "learning", "stats"];
// Detail pages carry what the lists leave out: a panda's media, evidence and relatives, a place's pandas.
const DETAILS = [
  { list: "pandas", file: "panda-details.jsonl", key: (item) => item.canonicalSlug },
  { list: "places", file: "place-details.jsonl", key: (item) => item.slug },
  { list: "institutions", file: "institution-details.jsonl", key: (item) => item.slug },
];
const CONCURRENCY = 8;

export class ExportError extends Error {}

/** Exports the release `base` serves into `<outDir>/<version>/`; returns the manifest. */
export async function exportPublicRelease({ base, outDir, fetchJson = defaultFetchJson, now = () => new Date() }) {
  const { version, releaseId } = await fetchJson(`${base}/api/v2/release`);
  if (!version || !releaseId) throw new ExportError("The API reports no active release.");

  // Every response that names its release must name the same one; a release that changes mid-run fails it.
  const sameRelease = (body, url) => {
    if (body?.release && body.release.releaseId !== releaseId) {
      throw new ExportError(`${url} answered for release ${body.release.version}, not ${version}; run the export again.`);
    }
    return body;
  };
  const get = async (route) => sameRelease(await fetchJson(`${base}${route}`), route);

  const files = new Map();
  const lists = {};
  for (const name of LISTS) {
    lists[name] = await get(`/api/v2/${name}`);
    files.set(`${name}.json`, { text: `${JSON.stringify(lists[name], null, 2)}\n`, count: lists[name].items?.length });
  }
  for (const detail of DETAILS) {
    const keys = lists[detail.list].items.map(detail.key);
    const bodies = await mapLimit(keys, CONCURRENCY, (key) => get(`/api/v2/${detail.list}/${encodeURIComponent(key)}`));
    files.set(detail.file, { text: bodies.map((body) => `${JSON.stringify(body)}\n`).join(""), count: bodies.length });
  }

  const manifest = {
    version,
    releaseId,
    source: base,
    exportedAt: now().toISOString(),
    files: Object.fromEntries([...files].map(([name, { text, count }]) => [
      name,
      { sha256: sha256(text), bytes: Buffer.byteLength(text), ...(count === undefined ? {} : { count }) },
    ])),
  };
  const target = path.join(outDir, version);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (const [name, { text }] of files) await writeFile(path.join(target, name), text, "utf8");
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(target, "manifest.json"), manifestText, "utf8");
  // The format `sha256sum -c` and `rclone checksum sha256` read.
  const sums = [...Object.entries(manifest.files).map(([name, file]) => [name, file.sha256]), ["manifest.json", sha256(manifestText)]]
    .map(([name, hash]) => `${hash}  ${name}\n`).join("");
  await writeFile(path.join(target, "SHA256SUMS"), sums, "utf8");
  return { manifest, target };
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function mapLimit(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}

async function defaultFetchJson(url) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { headers: { accept: "application/json" } }).catch((error) => ({ ok: false, status: error.message }));
    if (response.ok) return response.json();
    // A busy edge answers 429 or 5xx now and then; a missing page is a real gap and fails at once.
    if (attempt === 3 || response.status === 404) throw new ExportError(`${url} answered ${response.status}.`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = (process.env.PUBLIC_API_BASE_URL ?? "https://api.zhipanda.com").replace(/\/$/, "");
  const outDir = process.argv[2] ?? ".release-export";
  exportPublicRelease({ base, outDir })
    .then(({ manifest, target }) => {
      const counts = Object.entries(manifest.files).map(([name, file]) => `${name} ${file.count ?? file.bytes}`).join(", ");
      console.log(`[export] ${manifest.version} → ${target}: ${counts}`);
    })
    .catch((error) => {
      console.error(`[export] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
