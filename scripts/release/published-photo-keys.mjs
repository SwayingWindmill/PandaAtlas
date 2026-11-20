import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PHOTO_KEY_PATTERN = /^pandas\/photos\/[0-9a-f]{64}\.webp$/u;

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const DEFAULT_PHOTO_KEYS_PATH = path.join(REPO_ROOT, "apps/web/worker/published-photo-keys.json");
const CONCURRENCY = 8;

export class PublishedPhotoKeysError extends Error {}

function compareCodeUnits(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function normalizePublishedPhotoKeys(keys) {
  const unique = new Set();
  for (const key of keys) {
    if (typeof key !== "string" || !PHOTO_KEY_PATTERN.test(key)) {
      throw new PublishedPhotoKeysError(`Invalid published photo key: ${String(key)}`);
    }
    unique.add(key);
  }
  return [...unique].sort(compareCodeUnits);
}

export function formatPublishedPhotoKeys(keys) {
  return `${JSON.stringify(normalizePublishedPhotoKeys(keys), null, 2)}\n`;
}

export function validatePublishedPhotoKeysText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new PublishedPhotoKeysError(
      `Published photo keys file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new PublishedPhotoKeysError("Published photo keys must be a non-empty JSON array.");
  }
  const seen = new Set();
  for (let index = 0; index < parsed.length; index += 1) {
    const key = parsed[index];
    if (typeof key !== "string" || !PHOTO_KEY_PATTERN.test(key)) {
      throw new PublishedPhotoKeysError(`Invalid published photo key at index ${index}: ${String(key)}`);
    }
    if (seen.has(key)) {
      throw new PublishedPhotoKeysError(`Duplicate published photo key at index ${index}: ${key}`);
    }
    if (index > 0 && compareCodeUnits(parsed[index - 1], key) >= 0) {
      throw new PublishedPhotoKeysError(`Published photo keys are out of order before index ${index}: ${key}`);
    }
    seen.add(key);
  }
  const normalizedText = text.replace(/\r\n/gu, "\n");
  if (normalizedText !== formatPublishedPhotoKeys(parsed)) {
    throw new PublishedPhotoKeysError("Published photo keys formatting drifts from canonical 2-space JSON output.");
  }
  return parsed;
}

export async function extractPhotoKeysFromExport(exportDir) {
  const detailsPath = path.join(exportDir, "panda-details.jsonl");
  const content = await readFile(detailsPath, "utf8");
  const collected = [];
  for (const line of content.split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    const detail = JSON.parse(line);
    if (!Array.isArray(detail.media)) continue;
    for (const item of detail.media) {
      if (typeof item?.objectKey === "string" && item.objectKey.startsWith("pandas/photos/")) {
        collected.push(item.objectKey);
      }
    }
  }
  return normalizePublishedPhotoKeys(collected);
}

async function mapLimit(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

async function defaultFetchJson(url) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { headers: { accept: "application/json" } }).catch((error) => ({
      ok: false,
      status: error instanceof Error ? error.message : String(error),
    }));
    if (response.ok) return response.json();
    if (attempt === 3 || response.status === 404) {
      throw new PublishedPhotoKeysError(`${url} answered ${response.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
}

export async function fetchPhotoKeysFromApi({ base, fetchJson = defaultFetchJson }) {
  const root = base.replace(/\/$/u, "");
  const release = await fetchJson(`${root}/api/v2/release`);
  if (!release?.releaseId || !release?.version) {
    throw new PublishedPhotoKeysError("The API reports no active release.");
  }
  const sameRelease = (body, route) => {
    if (body?.release && body.release.releaseId !== release.releaseId) {
      throw new PublishedPhotoKeysError(
        `${route} answered for release ${body.release.version}, not ${release.version}; run the sync again.`,
      );
    }
    return body;
  };
  const pandas = sameRelease(await fetchJson(`${root}/api/v2/pandas`), "/api/v2/pandas");
  const slugs = (pandas.items ?? []).map((item) => item.canonicalSlug);
  const details = await mapLimit(slugs, CONCURRENCY, async (slug) => {
    const route = `/api/v2/pandas/${encodeURIComponent(slug)}`;
    return sameRelease(await fetchJson(`${root}${route}`), route);
  });
  const collected = [];
  for (const detail of details) {
    if (!Array.isArray(detail.media)) continue;
    for (const item of detail.media) {
      if (typeof item?.objectKey === "string" && item.objectKey.startsWith("pandas/photos/")) {
        collected.push(item.objectKey);
      }
    }
  }
  return normalizePublishedPhotoKeys(collected);
}

export function diffPhotoKeys(currentKeys, expectedKeys) {
  const currentSet = new Set(currentKeys);
  const expectedSet = new Set(expectedKeys);
  return {
    added: expectedKeys.filter((key) => !currentSet.has(key)),
    removed: currentKeys.filter((key) => !expectedSet.has(key)),
  };
}

function parseArgs(argv) {
  let mode = "check";
  let seenMode = false;
  let fromExport;
  let fromApi;
  let filePath = DEFAULT_PHOTO_KEYS_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check" || arg === "--write") {
      const nextMode = arg === "--write" ? "write" : "check";
      if (seenMode && mode !== nextMode) {
        throw new PublishedPhotoKeysError("Cannot combine --check and --write.");
      }
      mode = nextMode;
      seenMode = true;
    } else if (arg === "--from-export") {
      fromExport = argv[++index];
      if (!fromExport) throw new PublishedPhotoKeysError("--from-export requires a directory path.");
    } else if (arg === "--from-api") {
      fromApi = argv[++index];
      if (!fromApi) throw new PublishedPhotoKeysError("--from-api requires a base URL.");
    } else if (arg === "--file") {
      const next = argv[++index];
      if (!next) throw new PublishedPhotoKeysError("--file requires a path.");
      filePath = path.resolve(next);
    } else {
      throw new PublishedPhotoKeysError(`Unknown argument: ${arg}`);
    }
  }
  if (fromExport && fromApi) {
    throw new PublishedPhotoKeysError("Specify at most one of --from-export or --from-api.");
  }
  return { mode, fromExport, fromApi, filePath };
}

export async function runCli(argv = process.argv.slice(2)) {
  const { mode, fromExport, fromApi, filePath } = parseArgs(argv);
  const expected = fromExport
    ? await extractPhotoKeysFromExport(fromExport)
    : fromApi
      ? await fetchPhotoKeysFromApi({ base: fromApi })
      : undefined;

  if (mode === "write") {
    if (expected === undefined) {
      throw new PublishedPhotoKeysError("--write requires --from-export <dir> or --from-api <baseUrl>.");
    }
    if (expected.length === 0) {
      throw new PublishedPhotoKeysError("Refusing to write an empty published photo keys manifest.");
    }
    await writeFile(filePath, formatPublishedPhotoKeys(expected), "utf8");
    return { mode, count: expected.length, filePath };
  }

  const currentText = await readFile(filePath, "utf8");
  const current = validatePublishedPhotoKeysText(currentText);
  if (expected !== undefined) {
    const { added, removed } = diffPhotoKeys(current, expected);
    if (added.length > 0 || removed.length > 0) {
      throw new PublishedPhotoKeysError(
        `Published photo keys drift detected: +${added.length} added, -${removed.length} removed.`,
      );
    }
  }
  return { mode, count: current.length, filePath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runCli()
    .then(({ mode, count }) => {
      console.log(`[photo-keys] ${mode}: ${count} published photo keys verified.`);
    })
    .catch((error) => {
      console.error(`[photo-keys] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}
