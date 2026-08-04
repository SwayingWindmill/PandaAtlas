import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const defaultScanRoots = [
  "apps/web/app",
  "apps/web/components",
  "apps/web/features",
  "apps/web/lib",
  "services/api/app",
  "services/api/scripts",
  "scripts/release",
];

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".py"]);
const EXCLUDED_SEGMENTS = new Set([
  ".git",
  ".next",
  ".release-gate",
  ".venv",
  "__pycache__",
  "fixtures",
  "node_modules",
  "snapshots",
  "tests",
]);
const SENSITIVE_IDENTIFIERS = [
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "id_token",
  "idToken",
  "authorization_header",
  "authorizationHeader",
  "admin_api_token",
  "adminApiToken",
  "workflow_actor_tokens_json",
  "workflowActorTokensJson",
  "service_role_key",
  "serviceRoleKey",
  "private_key",
  "privateKey",
  "secret_key",
  "secretKey",
  "encryption_key",
  "encryptionKey",
  "signed_url",
  "signedUrl",
  "signed_reference",
  "signedReference",
  "ciphertext",
  "password",
  "otp",
  "cookie",
  "set_cookie",
  "setCookie",
];
const LOG_CALL_PATTERN = /(?:console\.(?:log|info|warn|error|debug)|logger\.(?:log|info|warn|error|debug|exception)|logging\.(?:info|warning|error|debug|exception)|print)\s*\(/;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SENSITIVE_PATTERN = new RegExp(
  `\\b(${SENSITIVE_IDENTIFIERS.map(escapeRegex).join("|")})\\b`,
  "g",
);

function excludedPath(relativePath) {
  const normalized = relativePath.split(path.sep);
  return normalized.some((segment) => EXCLUDED_SEGMENTS.has(segment))
    || /(?:^|\.)test\.[^.]+$/.test(path.basename(relativePath))
    || /(?:^|\.)spec\.[^.]+$/.test(path.basename(relativePath));
}

function sourceFiles(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath) || excludedPath(relativePath)) return [];
  const stats = statSync(absolutePath);
  if (stats.isFile()) {
    return SOURCE_EXTENSIONS.has(path.extname(absolutePath)) ? [relativePath] : [];
  }
  if (!stats.isDirectory()) return [];

  return readdirSync(absolutePath, { withFileTypes: true })
    .flatMap((entry) => sourceFiles(root, path.join(relativePath, entry.name)))
    .sort();
}

function stripQuotedText(line) {
  let output = "";
  let quote = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (escaped) {
      escaped = false;
      if (!quote) output += character;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      if (!quote) output += character;
      continue;
    }

    if (!quote && (character === "\"" || character === "'")) {
      quote = character;
      output += " ";
      continue;
    }
    if (quote && character === quote) {
      quote = null;
      output += " ";
      continue;
    }

    if (!quote && character === "`" && next !== undefined) {
      quote = "`";
      output += " ";
      continue;
    }
    if (quote === "`" && character === "`" && line[index - 1] !== "\\") {
      quote = null;
      output += " ";
      continue;
    }
    if (quote === "`" && character === "$" && next === "{") {
      output += "${";
      index += 1;
      let depth = 1;
      while (index + 1 < line.length && depth > 0) {
        index += 1;
        const embedded = line[index];
        if (embedded === "{") depth += 1;
        if (embedded === "}") depth -= 1;
        output += embedded;
      }
      continue;
    }

    output += quote ? " " : character;
  }
  return output;
}

export function scanSensitiveLogging({
  root = repositoryRoot,
  scanRoots = defaultScanRoots,
} = {}) {
  const files = scanRoots.flatMap((relativePath) => sourceFiles(root, relativePath));
  const violations = [];

  for (const relativePath of files) {
    const lines = readFileSync(path.join(root, relativePath), "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) {
        return;
      }
      if (!LOG_CALL_PATTERN.test(line)) return;

      const searchable = stripQuotedText(line);
      SENSITIVE_PATTERN.lastIndex = 0;
      for (const match of searchable.matchAll(SENSITIVE_PATTERN)) {
        violations.push({
          path: relativePath.split(path.sep).join("/"),
          line: index + 1,
          identifier: match[1],
          source: trimmed,
        });
      }
    });
  }

  return {
    outcome: violations.length === 0 ? "passed" : "failed",
    scanned_files: files.length,
    scan_roots: scanRoots,
    violations,
  };
}

export function run() {
  const report = scanSensitiveLogging();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.outcome !== "passed") process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
