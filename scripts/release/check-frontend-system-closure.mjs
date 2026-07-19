import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, "..", "..");
const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  ".open-next",
  "node_modules",
  "playwright-report",
  "test-results",
]);

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function listFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await walk(directory);
  return files;
}

function normalizedRelative(root, absolute) {
  return path.relative(root, absolute).replaceAll("\\", "/");
}

function sameMembers(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function collectFeatureImports(source) {
  const imports = [];
  const expression = /(?:from\s*|import\s*\()\s*["']@\/features\/([^/"']+)(?:\/[^"']*)?["']/g;
  for (const match of source.matchAll(expression)) imports.push(match[1]);
  return imports;
}

function collectModuleSpecifiers(source) {
  const specifiers = [];
  const expressions = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
  ];
  for (const expression of expressions) {
    for (const match of source.matchAll(expression)) specifiers.push(match[1]);
  }
  return [...new Set(specifiers)];
}

function hasCatchReturn(source) {
  return /catch\s*(?:\([^)]*\))?\s*\{[\s\S]{0,800}?\breturn\b/.test(source);
}

function forbiddenProductionImportSegment(specifier, forbiddenSegments) {
  const segments = specifier.toLowerCase().split(/[\/._-]+/).filter(Boolean);
  return forbiddenSegments.find((segment) => segments.includes(segment)) ?? null;
}

function sourceFeature(relativePath) {
  const match = relativePath.match(/^apps\/web\/features\/([^/]+)\//);
  return match?.[1] ?? null;
}

function hasRawDesignOwnership(source) {
  const rawHex = /#[0-9a-fA-F]{3,8}\b/;
  const rawColorFunction = /\b(?:rgb|rgba|hsl|hsla)\s*\(/;
  const rawTailwindOwnership = /(?:(?:bg|text|border)-\[(?:#|rgba?\(|hsla?\()|(?:shadow|rounded|z)-\[(?!var\())/;
  return rawHex.test(source) || rawColorFunction.test(source) || rawTailwindOwnership.test(source);
}

function validateInventoryCoverage(contract, inventory, label, errors) {
  if (inventory.schema_version !== 1) errors.push(`${label}.schema_version must equal 1`);
  const ids = inventory.surfaces?.map((surface) => surface.id) ?? [];
  if (!sameMembers(ids, contract.canonical_surface_ids)) {
    errors.push(`${label} must cover exactly the canonical surface IDs`);
  }
  for (const surface of inventory.surfaces ?? []) {
    const detail = surface.states ?? surface.scenarios ?? surface.html_paths;
    if (!Array.isArray(detail)) errors.push(`${label}.${surface.id} must contain an inventory array`);
  }
}

export async function validateFrontendSystemClosure(root = defaultRoot) {
  const errors = [];
  const contractPath = "contracts/frontend-system-closure.v1.json";
  const contract = await readJson(root, contractPath);
  if (contract.schema_version !== 1) errors.push("system closure contract schema_version must equal 1");

  for (const relativePath of contract.forbidden_legacy_paths ?? []) {
    if (existsSync(path.join(root, relativePath))) errors.push(`forbidden legacy path still exists: ${relativePath}`);
  }

  for (const relativePath of contract.redirect_only_routes ?? []) {
    const absolute = path.join(root, relativePath);
    if (!existsSync(absolute)) {
      errors.push(`redirect-only route is missing: ${relativePath}`);
      continue;
    }
    const source = await readFile(absolute, "utf8");
    if (!source.includes("permanentRedirect")) errors.push(`${relativePath} must call permanentRedirect`);
    if (!source.includes("localizedPublicDestination")) {
      errors.push(`${relativePath} must resolve its target through localizedPublicDestination`);
    }
    if (/<(?:main|section|article|header|footer|nav)\b|return\s*\(/.test(source)) {
      errors.push(`${relativePath} must not render public UI`);
    }
  }

  const styleEntry = await readFile(path.join(root, contract.style_entry), "utf8");
  const styleLines = styleEntry.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (styleLines.some((line) => !/^@import\s+/.test(line)) || styleEntry.includes("{")) {
    errors.push(`${contract.style_entry} must contain imports only`);
  }

  const featureRoot = path.join(root, "apps", "web", "features");
  const featureFiles = (await listFiles(featureRoot)).filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file));
  const allowedCrossFeatureTargets = new Set(contract.allowed_cross_feature_targets ?? []);
  const forbiddenProductionImportSegments = (contract.forbidden_production_import_segments ?? [])
    .map((segment) => String(segment).toLowerCase());
  const explicitFallbackPaths = new Set(
    (contract.explicit_fallback_provenance ?? []).map((entry) => entry.path),
  );
  const silentFallbackAllowlist = new Set(contract.silent_fallback_source_allowlist ?? []);

  for (const entry of contract.explicit_fallback_provenance ?? []) {
    const absolute = path.join(root, entry.path);
    if (!existsSync(absolute)) {
      errors.push(`explicit fallback provenance file is missing: ${entry.path}`);
      continue;
    }
    const source = await readFile(absolute, "utf8");
    for (const marker of entry.required_markers ?? []) {
      if (!source.includes(marker)) {
        errors.push(`explicit fallback provenance marker is missing: ${entry.path} -> ${marker}`);
      }
    }
  }

  for (const absolute of featureFiles) {
    const relative = normalizedRelative(root, absolute);
    const owner = sourceFeature(relative);
    const source = await readFile(absolute, "utf8");
    for (const target of collectFeatureImports(source)) {
      if (target !== owner && !allowedCrossFeatureTargets.has(target)) {
        errors.push(`cross-feature deep import is not allowed: ${relative} -> ${target}`);
      }
    }
    for (const specifier of collectModuleSpecifiers(source)) {
      const forbiddenSegment = forbiddenProductionImportSegment(
        specifier,
        forbiddenProductionImportSegments,
      );
      if (forbiddenSegment) {
        errors.push(`production data import uses a forbidden segment: ${relative} -> ${specifier}`);
      }
    }
    if (
      hasCatchReturn(source)
      && !explicitFallbackPaths.has(relative)
      && !silentFallbackAllowlist.has(relative)
    ) {
      errors.push(`catch-return fallback must expose explicit provenance: ${relative}`);
    }
  }

  const appSourceFiles = (await listFiles(path.join(root, "apps", "web"))).filter(
    (file) => /\.(?:ts|tsx|js|jsx)$/.test(file) && !normalizedRelative(root, file).includes("/tests/"),
  );
  const rawOwnershipAllowlist = new Set(contract.raw_design_value_source_allowlist ?? []);
  for (const absolute of appSourceFiles) {
    const relative = normalizedRelative(root, absolute);
    const source = await readFile(absolute, "utf8");
    if (!relative.startsWith("apps/web/features/")) {
      for (const specifier of collectModuleSpecifiers(source)) {
        const forbiddenSegment = forbiddenProductionImportSegment(
          specifier,
          forbiddenProductionImportSegments,
        );
        if (forbiddenSegment) {
          errors.push(`production data import uses a forbidden segment: ${relative} -> ${specifier}`);
        }
      }
    }
    if (rawOwnershipAllowlist.has(relative)) continue;
    if (hasRawDesignOwnership(source)) {
      errors.push(`raw design value ownership must live in an approved style seam: ${relative}`);
    }
  }

  const mediaManifest = await readJson(root, contract.media_manifest);
  if (mediaManifest.schema_version !== 1) errors.push("public media manifest schema_version must equal 1");
  const publicRoot = path.join(root, mediaManifest.public_root);
  const actualMedia = (await listFiles(publicRoot)).map((file) => normalizedRelative(publicRoot, file));
  const manifestMedia = (mediaManifest.assets ?? []).map((asset) => asset.path);
  if (!sameMembers(actualMedia, manifestMedia)) {
    errors.push("public media manifest must exactly match files under the public root");
  }
  for (const asset of mediaManifest.assets ?? []) {
    for (const field of ["path", "license", "source", "reviewed_at"]) {
      if (typeof asset[field] !== "string" || !asset[field].trim()) {
        errors.push(`public media asset ${asset.path ?? "unknown"} is missing ${field}`);
      }
    }
  }

  const stateRegistry = await readJson(root, contract.state_registry);
  validateInventoryCoverage(contract, stateRegistry, "state registry", errors);
  for (const surface of stateRegistry.surfaces ?? []) {
    if (!surface.route_pattern || !surface.states?.length) {
      errors.push(`state registry surface ${surface.id} must define a route and states`);
    }
  }

  const screenshotInventory = await readJson(root, contract.screenshot_inventory);
  validateInventoryCoverage(contract, screenshotInventory, "screenshot inventory", errors);
  for (const surface of screenshotInventory.surfaces ?? []) {
    if (!surface.paths?.length || !surface.scenarios?.length) {
      errors.push(`screenshot inventory surface ${surface.id} must define paths and scenarios`);
    }
  }

  const routeBudgetInventory = await readJson(root, contract.route_budget_inventory);
  validateInventoryCoverage(contract, routeBudgetInventory, "route budget inventory", errors);
  for (const surface of routeBudgetInventory.surfaces ?? []) {
    if (!surface.manifest_entry || !Array.isArray(surface.html_paths)) {
      errors.push(`route budget inventory surface ${surface.id} is incomplete`);
    }
  }

  const playwrightConfig = await readFile(path.join(root, "apps/web/playwright.config.ts"), "utf8");
  const releaseWorkflow = await readFile(path.join(root, ".github/workflows/release-gate.yml"), "utf8");
  for (const browser of contract.browser_matrix ?? []) {
    if (!playwrightConfig.includes(`name: "${browser}"`)) {
      errors.push(`Playwright browser matrix is missing ${browser}`);
    }
    if (!releaseWorkflow.includes(browser)) {
      errors.push(`Release workflow does not install ${browser}`);
    }
  }
  if (!releaseWorkflow.includes('PLAYWRIGHT_BROWSER_MATRIX: "1"')) {
    errors.push("Release workflow must enable the Playwright browser matrix");
  }

  return errors;
}

async function runCli() {
  const errors = await validateFrontendSystemClosure(defaultRoot);
  if (errors.length) {
    for (const error of errors) process.stderr.write(`[frontend-system-closure] ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("[frontend-system-closure] PASS\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
