import { execFileSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";

const RULES = [
  {
    level: 3,
    reason: "Cloudflare public entry, versioned release schema or production migration semantics",
    patterns: [
      /^apps\/web\/cloudflare\//,
      /^apps\/web\/wrangler(?:\.staging)?\.jsonc$/,
      /^infra\/cloudflare\/d1\/migrations\//,
      /^scripts\/release\/apply-d1-migrations\.mjs$/,
      /^scripts\/release\/d1-public-release\.mjs$/,
      /^scripts\/release\/apply-public-release-d1\.mjs$/,
      /^scripts\/release\/rollback-public-release-d1\.mjs$/,
      /^scripts\/release\/check-beta-hard-gates\.mjs$/,
      /^scripts\/release\/media-integrity\.mjs$/,
      /^scripts\/release\/api-staging-withdrawal\.mjs$/,
      /^scripts\/release\/run-api-staging-withdrawal\.mjs$/,
      /^services\/worker-api\/wrangler\.staging\.jsonc$/,
      /^services\/worker-api\/package\.json$/,
    ],
  },
  {
    level: 3,
    reason: "Global shell, locale architecture, Public Content Envelope or delivery semantics",
    patterns: [
      /^apps\/web\/app\/\[locale\]\/layout\.tsx$/,
      /^apps\/web\/foundation\/content\/locales\.ts$/,
      /^apps\/web\/features\/public-content\//,
      /^apps\/web\/components\/patterns\/global-navigation\.tsx$/,
      /^apps\/web\/components\/patterns\/public-delivery-notice\.tsx$/,
      /^contracts\/frontend-release-evidence\./,
    ],
  },
  {
    level: 2,
    reason: "Public route, navigation, form, state component or Client boundary",
    patterns: [
      /^apps\/web\/app\//,
      /^apps\/web\/components\/patterns\//,
      /^apps\/web\/components\/atlas\/trusted-panda-profile\.tsx$/,
      /^apps\/web\/features\/profile\//,
      /^apps\/web\/middleware\.ts$/,
      /^apps\/web\/playwright\.config\.ts$/,
      /^apps\/web\/tests\/smoke\//,
    ],
  },
  {
    level: 1,
    reason: "Public CSS, token, copy or visual foundation",
    patterns: [
      /^apps\/web\/styles\//,
      /^apps\/web\/app\/globals\.css$/,
    ],
  },
];

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function classifyFrontendRisk(paths) {
  const normalizedPaths = [...new Set(paths.map(normalizePath).filter(Boolean))];
  let level = 0;
  const matches = [];

  for (const path of normalizedPaths) {
    for (const rule of RULES) {
      if (rule.patterns.some((pattern) => pattern.test(path))) {
        level = Math.max(level, rule.level);
        matches.push({ path, level: rule.level, reason: rule.reason });
        break;
      }
    }
  }

  return {
    level,
    label: `Level ${level}`,
    changed_paths: normalizedPaths,
    matches,
  };
}

function runCli() {
  const explicitPaths = process.argv.slice(2);
  const paths = explicitPaths.length
    ? explicitPaths
    : execFileSync(
        "git",
        ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        { encoding: "utf8" },
      ).split(/\r?\n/).filter(Boolean);
  const result = classifyFrontendRisk(paths);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
