import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const contractRelativePath = "contracts/zhipanda-brand-migration.v1.json";
const contractPath = path.join(repoRoot, contractRelativePath);

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function countOccurrences(contents, term) {
  if (!term) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = contents.indexOf(term, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + term.length;
  }
}

async function repositoryPaths(contract) {
  const ignoredDirectories = new Set(contract.scan.excluded_directories);
  const files = [];

  async function walk(absoluteDirectory, relativeDirectory = "") {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = normalizePath(path.join(relativeDirectory, entry.name));
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) continue;
        await walk(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  await walk(repoRoot);
  return files.sort();
}

function isBinary(buffer) {
  const sampleLength = Math.min(buffer.length, 8192);
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function pathIsWithin(relativePath, roots) {
  return roots.some((root) => relativePath.startsWith(root));
}

function sameMatches(left, right, terms) {
  return terms.every((term) => (left[term] ?? 0) === (right[term] ?? 0));
}

async function scanReferences(contract) {
  const excluded = new Set(contract.scan.excluded_paths);
  const references = [];
  const publicViolations = [];
  const paths = await repositoryPaths(contract);

  for (const relativePath of paths) {
    if (excluded.has(relativePath)) continue;
    const absolutePath = path.join(repoRoot, relativePath);
    const buffer = await readFile(absolutePath);
    if (isBinary(buffer)) continue;
    const contents = buffer.toString("utf8");
    const matches = Object.fromEntries(
      contract.legacy_terms
        .map((term) => [term, countOccurrences(contents, term)])
        .filter(([, count]) => count > 0),
    );
    if (Object.keys(matches).length > 0) references.push({ path: relativePath, matches });

    const isPublicSource = pathIsWithin(relativePath, contract.scan.public_source_roots)
      && !pathIsWithin(relativePath, contract.scan.public_source_exclusions);
    if (!isPublicSource) continue;
    for (const term of contract.public_legacy_brand_terms) {
      const count = countOccurrences(contents, term);
      if (count > 0) publicViolations.push({ path: relativePath, term, count });
    }
  }

  return { references, publicViolations, repositoryPaths: paths };
}

function validateContractShape(contract, repositoryPathList, failures) {
  if (contract.contract_version !== "1.0.0") failures.push("Unsupported brand contract version.");
  if (contract.public_brand?.zh !== "吱熊猫" || contract.public_brand?.en !== "ZhiPanda") {
    failures.push("Public brand must remain 吱熊猫 / ZhiPanda.");
  }

  const requiredTone = ["warm", "lively", "curious", "concise", "non-childish", "evidence-honest"];
  for (const value of requiredTone) {
    if (!contract.tone?.required?.includes(value)) failures.push(`Missing required tone value: ${value}`);
  }

  const requiredTerms = [
    "panda_profile",
    "panda_family",
    "journey",
    "place",
    "institution",
    "follow",
    "activity",
    "source",
    "verification",
    "partial_data",
    "unavailable_data",
    "correction",
  ];
  for (const key of requiredTerms) {
    const term = contract.controlled_terms?.[key];
    if (!term?.zh || !term?.en) failures.push(`Controlled term ${key} must define Chinese and English copy.`);
  }

  const repositoryPathSet = new Set(repositoryPathList);
  const seen = new Set();
  const categories = new Set(contract.classification_values?.category ?? []);
  const visibilities = new Set(contract.classification_values?.user_visibility ?? []);
  const actions = new Set(contract.classification_values?.expected_action ?? []);

  for (const entry of contract.inventory ?? []) {
    if (!entry.path || seen.has(entry.path)) failures.push(`Inventory path is missing or duplicated: ${entry.path ?? "<missing>"}`);
    seen.add(entry.path);
    if (!repositoryPathSet.has(entry.path)) failures.push(`Inventory path is not present in the repository: ${entry.path}`);
    if (!categories.has(entry.category)) failures.push(`Invalid category for ${entry.path}: ${entry.category}`);
    if (entry.category === "undecided") failures.push(`Inventory entry remains undecided: ${entry.path}`);
    if (!visibilities.has(entry.user_visibility)) failures.push(`Invalid user visibility for ${entry.path}: ${entry.user_visibility}`);
    if (!actions.has(entry.expected_action)) failures.push(`Invalid expected action for ${entry.path}: ${entry.expected_action}`);
    if (!entry.migration_owner || !entry.rationale) failures.push(`Inventory entry needs an owner and rationale: ${entry.path}`);
    if (entry.category === "public-visible" && !entry.expected_action.startsWith("migrate-in-")) {
      failures.push(`Public-visible entry lacks an assigned migration ticket: ${entry.path}`);
    }
    if (entry.expected_action.startsWith("migrate-in-") && entry.category !== "public-visible") {
      failures.push(`Migration action is assigned to a non-public entry: ${entry.path}`);
    }

    const matchKeys = Object.keys(entry.matches ?? {});
    if (matchKeys.length === 0) failures.push(`Inventory entry has no legacy matches: ${entry.path}`);
    for (const [term, count] of Object.entries(entry.matches ?? {})) {
      if (!contract.legacy_terms.includes(term)) failures.push(`Inventory entry uses an unknown legacy term in ${entry.path}: ${term}`);
      if (!Number.isInteger(count) || count <= 0) failures.push(`Inventory count must be a positive integer in ${entry.path}: ${term}`);
    }
  }
}

function compareInventory(contract, scan, failures) {
  const inventoryByPath = new Map(contract.inventory.map((entry) => [entry.path, entry]));
  const scannedByPath = new Map(scan.references.map((entry) => [entry.path, entry]));

  for (const reference of scan.references) {
    const inventory = inventoryByPath.get(reference.path);
    if (!inventory) {
      failures.push(`Unclassified legacy reference: ${reference.path}`);
      continue;
    }
    if (!sameMatches(reference.matches, inventory.matches, contract.legacy_terms)) {
      failures.push(`Legacy reference counts changed without inventory review: ${reference.path}`);
    }
  }

  for (const inventory of contract.inventory) {
    if (!scannedByPath.has(inventory.path)) failures.push(`Stale inventory entry has no current legacy reference: ${inventory.path}`);
  }

  for (const violation of scan.publicViolations) {
    failures.push(`Public source exposes retired brand ${violation.term} (${violation.count}): ${violation.path}`);
  }
}

const contract = JSON.parse(await readFile(contractPath, "utf8"));
const scan = await scanReferences(contract);
const refreshInventory = process.argv.includes("--refresh-inventory");
const reportArgument = process.argv.find((argument) => argument.startsWith("--write-report="));

if (refreshInventory) {
  const existingByPath = new Map(contract.inventory.map((entry) => [entry.path, entry]));
  const unclassified = scan.references.filter((reference) => !existingByPath.has(reference.path));
  if (unclassified.length > 0) {
    console.error("Inventory refresh refused new unclassified files:");
    for (const reference of unclassified) console.error(`- ${reference.path}`);
    process.exit(1);
  }
  contract.inventory = scan.references.map((reference) => ({
    ...existingByPath.get(reference.path),
    matches: reference.matches,
  }));
  await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  console.log(`Refreshed ${contract.inventory.length} existing legacy-brand inventory entries.`);
  process.exit(0);
}

if (reportArgument) {
  const reportPath = path.resolve(repoRoot, reportArgument.slice("--write-report=".length));
  const report = { contract_version: contract.contract_version, references: scan.references };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote deterministic legacy-brand scan to ${normalizePath(path.relative(repoRoot, reportPath))}.`);
  process.exit(0);
}

const failures = [];
validateContractShape(contract, scan.repositoryPaths, failures);
compareInventory(contract, scan, failures);

if (failures.length > 0) {
  console.error("ZhiPanda brand contract check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ZhiPanda brand contract check passed (${scan.references.length} classified files).`);
