import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

// Vendored agent skills describe other repositories' layouts.
const UNCHECKED_PREFIXES = [".agents/"];
// ADRs record decisions as of their date, so their inline paths may name retired files.
const ADR_PATTERN = /(^|\/)adr-\d{4}-[^/]+\.md$/u;
const LINK_PATTERN = /\]\(([^)\s]+)\)/gu;
const INLINE_CODE_PATTERN = /`([^`\s]+)`/gu;
const PLACEHOLDER_PATTERN = /[<>{}*$]/u;

function isExternal(href) {
  return /^[a-z][a-z0-9+.-]*:/iu.test(href) || href.startsWith("#") || href.startsWith("//");
}

function toRepositoryPath(absolute, cwd) {
  return path.relative(cwd, absolute).split(path.sep).join("/");
}

function git(cwd, args, input) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", input, maxBuffer: 20 * 1024 * 1024, windowsHide: true });
  // check-ignore exits 1 when nothing is ignored.
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error(`git ${args[0]} failed: ${result.error?.message ?? result.stderr}`);
  }
  return String(result.stdout ?? "").split("\0").filter(Boolean);
}

// A documented local-state location (a Git-ignored directory such as a media inbox) is not broken.
// A reference written with a trailing slash names a directory, so it is asked about as one.
function gitIgnoredPaths(cwd, queries) {
  if (queries.length === 0) return new Set();
  return new Set(git(cwd, ["check-ignore", "--no-index", "--stdin", "-z"], queries.join("\0")));
}

/**
 * Finds Markdown references to repository paths that do not exist: relative links, and inline
 * code spans that start with a tracked top-level directory. Returns `{ file, line, reference }`.
 */
export function findBrokenDocReferences({ cwd = repoRoot, trackedFiles, isIgnored } = {}) {
  const files = trackedFiles ?? git(cwd, ["ls-files", "-z"]);
  const topLevel = new Set(files.filter((file) => file.includes("/")).map((file) => file.split("/")[0]));
  const markdown = files.filter(
    (file) => file.endsWith(".md") && !UNCHECKED_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );

  const candidates = [];
  for (const file of markdown) {
    const absoluteFile = path.join(cwd, file);
    if (!existsSync(absoluteFile)) continue;
    const checkInlinePaths = !ADR_PATTERN.test(file);
    let fenced = false;
    readFileSync(absoluteFile, "utf8")
      .split(/\r?\n/u)
      .forEach((text, index) => {
        if (/^\s*(```|~~~)/u.test(text)) {
          fenced = !fenced;
          return;
        }
        if (fenced) return;
        for (const [, href] of text.matchAll(LINK_PATTERN)) {
          if (isExternal(href)) continue;
          const target = decodeURI(href.split("#")[0]);
          const absolute = path.resolve(path.dirname(absoluteFile), target);
          candidates.push({ file, line: index + 1, reference: href.split("#")[0], absolute });
        }
        if (!checkInlinePaths) return;
        for (const [, raw] of text.matchAll(INLINE_CODE_PATTERN)) {
          const token = raw.split("#")[0].replace(/[,.;:]+$/u, "");
          if (!token.includes("/") || PLACEHOLDER_PATTERN.test(token)) continue;
          if (!topLevel.has(token.split("/")[0])) continue;
          candidates.push({ file, line: index + 1, reference: token, absolute: path.join(cwd, token) });
        }
      });
  }

  const missing = candidates
    .filter(({ absolute }) => !existsSync(absolute))
    .map((candidate) => ({
      ...candidate,
      query: toRepositoryPath(candidate.absolute, cwd) + (candidate.reference.endsWith("/") ? "/" : ""),
    }));
  const ignored = isIgnored ? null : gitIgnoredPaths(cwd, [...new Set(missing.map(({ query }) => query))]);
  return missing
    .filter(({ query }) => (isIgnored ? !isIgnored(query) : !ignored.has(query)))
    .map(({ file, line, reference }) => ({ file, line, reference }));
}

export function checkDocReferences({ cwd = repoRoot, quiet = false } = {}) {
  const broken = findBrokenDocReferences({ cwd });
  if (broken.length > 0) {
    const details = broken.map(({ file, line, reference }) => `- ${file}:${line} -> ${reference}`).join("\n");
    throw new Error(`Documentation references missing repository paths:\n${details}`);
  }
  if (!quiet) console.log("[doc-references] passed");
  return broken;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    checkDocReferences();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
