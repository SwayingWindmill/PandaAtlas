import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import ignore from "ignore";
import { fromMarkdown } from "mdast-util-from-markdown";

import { listTrackedPaths } from "./repository-paths.mjs";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

// Vendored agent skills describe other repositories' layouts.
const UNCHECKED_PREFIXES = [".agents/"];
// ADRs record decisions as of their date, so their inline paths may name retired files; their
// links are still checked.
const ADR_PATTERN = /(^|\/)adr-\d{4}-[^/]+\.md$/u;
const PLACEHOLDER_PATTERN = /[<>{}*$\s]/u;

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isExternal(url) {
  return /^[a-z][a-z0-9+.-]*:/iu.test(url) || url.startsWith("#") || url.startsWith("//");
}

// A tracked .gitignore governs the paths below its own directory. Local excludes do not count.
function ignoreMatcher(cwd, trackedFiles) {
  const rules = trackedFiles
    .filter((file) => file === ".gitignore" || file.endsWith("/.gitignore"))
    .map((file) => ({
      base: path.posix.dirname(file) === "." ? "" : `${path.posix.dirname(file)}/`,
      matcher: ignore().add(readFileSync(path.join(cwd, file), "utf8")),
    }));
  return (repositoryPath) =>
    rules.some(
      ({ base, matcher }) => repositoryPath.startsWith(base) && matcher.ignores(repositoryPath.slice(base.length)),
    );
}

function visit(node, callback) {
  callback(node);
  for (const child of node.children ?? []) visit(child, callback);
}

/**
 * Finds Markdown references to repository paths that do not exist: link, image and definition
 * targets, and inline code that starts with a tracked top-level directory. Returns
 * `{ file, line, reference }` for each.
 */
export function findBrokenDocReferences({ cwd = repoRoot, trackedFiles = listTrackedPaths({ cwd }) } = {}) {
  const ignored = ignoreMatcher(cwd, trackedFiles);
  const topLevel = new Set(trackedFiles.filter((file) => file.includes("/")).map((file) => file.split("/")[0]));
  const markdown = trackedFiles.filter(
    (file) => file.endsWith(".md") && !UNCHECKED_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );

  const broken = [];
  const check = (file, line, reference, absolute) => {
    if (existsSync(absolute)) return;
    const repositoryPath = path.relative(cwd, absolute).split(path.sep).join("/");
    // A reference written with a trailing slash names a directory.
    if (ignored(repositoryPath + (reference.endsWith("/") ? "/" : ""))) return;
    broken.push({ file, line, reference });
  };

  for (const file of markdown) {
    const absoluteFile = path.join(cwd, file);
    if (!existsSync(absoluteFile)) continue;
    const checkInlinePaths = !ADR_PATTERN.test(file);
    visit(fromMarkdown(readFileSync(absoluteFile, "utf8")), (node) => {
      const line = node.position?.start.line;
      if ((node.type === "link" || node.type === "image" || node.type === "definition") && !isExternal(node.url)) {
        const target = decode(node.url.split(/[?#]/u)[0]);
        if (!target) return;
        const absolute = target.startsWith("/")
          ? path.join(cwd, target)
          : path.resolve(path.dirname(absoluteFile), target);
        check(file, line, target, absolute);
      } else if (node.type === "inlineCode" && checkInlinePaths) {
        const token = node.value.split("#")[0].replace(/(:\d+)+$/u, "").replace(/[,.;:]+$/u, "");
        if (!token.includes("/") || PLACEHOLDER_PATTERN.test(token)) return;
        if (!topLevel.has(token.split("/")[0])) return;
        check(file, line, token, path.join(cwd, token));
      }
    });
  }
  return broken;
}

export function checkDocReferences({ cwd = repoRoot, quiet = false } = {}) {
  const broken = findBrokenDocReferences({ cwd });
  if (broken.length > 0) {
    const details = broken.map(({ file, line, reference }) => `- ${file}:${line} -> ${reference}`).join("\n");
    throw new Error(`Documentation references missing repository paths:\n${details}`);
  }
  if (!quiet) console.log("[doc-references] passed");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    checkDocReferences();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
