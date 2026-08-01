import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
export const defaultContractPath = path.join(
  repoRoot,
  "contracts",
  "repository-structure.v1.json",
);

const CONTRACT_KEYS = new Set([
  "schema_version",
  "title",
  "top_level",
  "npm",
  "zones",
  "status_documents",
  "markdown_documents",
  "required_root_scripts",
]);
const TOP_LEVEL_KEYS = new Set([
  "allowed_directories",
  "required_directories",
  "allowed_files",
  "required_files",
]);
const NPM_KEYS = new Set([
  "manifest",
  "workspace_patterns",
  "forbidden_workspace_patterns",
  "packages",
  "python_service_roots",
]);
const PACKAGE_KEYS = new Set(["path", "name", "private", "role"]);
const ZONE_KEYS = new Set([
  "path",
  "kind",
  "boundary_document",
  "required_paths",
  "governance_paths",
]);
const STATUS_DOCUMENT_KEYS = new Set(["path", "required_markers"]);
const LOCAL_LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/gu;

export class RepositoryStructureError extends Error {
  constructor(violations) {
    const ordered = [...new Set(violations)].sort();
    super(`Repository structure check failed with ${ordered.length} violation(s)`);
    this.name = "RepositoryStructureError";
    this.violations = ordered;
  }
}

export function normalizeRepositoryPath(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/gu, "/");
}

function unknownKeys(value, allowed, label, violations) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${label} must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) violations.push(`${label} contains unknown field: ${key}`);
  }
}

function validateStringArray(value, label, violations, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    violations.push(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array`);
    return;
  }
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") {
      violations.push(`${label} values must be non-empty strings`);
      continue;
    }
    if (seen.has(item)) violations.push(`${label} values must be unique: ${item}`);
    seen.add(item);
  }
}

function validateRelativePath(value, label, violations) {
  if (typeof value !== "string" || value.trim() === "") {
    violations.push(`${label} must be a non-empty repository-relative path`);
    return;
  }
  const normalized = normalizeRepositoryPath(value);
  if (
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    violations.push(`${label} must stay inside the repository: ${value}`);
  }
}

export function validateRepositoryStructureContract(contract) {
  const violations = [];
  unknownKeys(contract, CONTRACT_KEYS, "contract", violations);
  if (contract?.schema_version !== 1) violations.push("schema_version must be 1");
  if (typeof contract?.title !== "string" || contract.title.trim() === "") {
    violations.push("title must be a non-empty string");
  }

  unknownKeys(contract?.top_level, TOP_LEVEL_KEYS, "top_level", violations);
  for (const key of TOP_LEVEL_KEYS) {
    validateStringArray(contract?.top_level?.[key], `top_level.${key}`, violations);
  }

  unknownKeys(contract?.npm, NPM_KEYS, "npm", violations);
  validateRelativePath(contract?.npm?.manifest, "npm.manifest", violations);
  validateStringArray(contract?.npm?.workspace_patterns, "npm.workspace_patterns", violations);
  validateStringArray(
    contract?.npm?.forbidden_workspace_patterns,
    "npm.forbidden_workspace_patterns",
    violations,
    { allowEmpty: true },
  );
  validateStringArray(
    contract?.npm?.python_service_roots,
    "npm.python_service_roots",
    violations,
  );

  if (!Array.isArray(contract?.npm?.packages) || contract.npm.packages.length === 0) {
    violations.push("npm.packages must be a non-empty array");
  } else {
    const packagePaths = new Set();
    const packageNames = new Set();
    for (const [index, packageEntry] of contract.npm.packages.entries()) {
      const label = `npm.packages[${index}]`;
      unknownKeys(packageEntry, PACKAGE_KEYS, label, violations);
      validateRelativePath(packageEntry?.path, `${label}.path`, violations);
      if (typeof packageEntry?.name !== "string" || packageEntry.name.trim() === "") {
        violations.push(`${label}.name must be a non-empty string`);
      }
      if (typeof packageEntry?.private !== "boolean") {
        violations.push(`${label}.private must be boolean`);
      }
      if (typeof packageEntry?.role !== "string" || packageEntry.role.trim() === "") {
        violations.push(`${label}.role must be a non-empty string`);
      }
      if (packagePaths.has(packageEntry?.path)) {
        violations.push(`npm package paths must be unique: ${packageEntry?.path}`);
      }
      if (packageNames.has(packageEntry?.name)) {
        violations.push(`npm package names must be unique: ${packageEntry?.name}`);
      }
      packagePaths.add(packageEntry?.path);
      packageNames.add(packageEntry?.name);
    }
  }

  if (!Array.isArray(contract?.zones) || contract.zones.length === 0) {
    violations.push("zones must be a non-empty array");
  } else {
    const zonePaths = new Set();
    for (const [index, zone] of contract.zones.entries()) {
      const label = `zones[${index}]`;
      unknownKeys(zone, ZONE_KEYS, label, violations);
      validateRelativePath(zone?.path, `${label}.path`, violations);
      validateRelativePath(zone?.boundary_document, `${label}.boundary_document`, violations);
      validateStringArray(zone?.required_paths, `${label}.required_paths`, violations);
      validateStringArray(zone?.governance_paths, `${label}.governance_paths`, violations);
      if (typeof zone?.kind !== "string" || zone.kind.trim() === "") {
        violations.push(`${label}.kind must be a non-empty string`);
      }
      if (zonePaths.has(zone?.path)) violations.push(`zone paths must be unique: ${zone?.path}`);
      zonePaths.add(zone?.path);
    }
  }

  if (!Array.isArray(contract?.status_documents) || contract.status_documents.length === 0) {
    violations.push("status_documents must be a non-empty array");
  } else {
    const statusPaths = new Set();
    for (const [index, document] of contract.status_documents.entries()) {
      const label = `status_documents[${index}]`;
      unknownKeys(document, STATUS_DOCUMENT_KEYS, label, violations);
      validateRelativePath(document?.path, `${label}.path`, violations);
      validateStringArray(document?.required_markers, `${label}.required_markers`, violations);
      if (statusPaths.has(document?.path)) {
        violations.push(`status document paths must be unique: ${document?.path}`);
      }
      statusPaths.add(document?.path);
    }
  }

  validateStringArray(contract?.markdown_documents, "markdown_documents", violations);
  for (const [index, documentPath] of (contract?.markdown_documents ?? []).entries()) {
    validateRelativePath(documentPath, `markdown_documents[${index}]`, violations);
  }

  if (
    !contract?.required_root_scripts ||
    typeof contract.required_root_scripts !== "object" ||
    Array.isArray(contract.required_root_scripts) ||
    Object.keys(contract.required_root_scripts).length === 0
  ) {
    violations.push("required_root_scripts must be a non-empty object");
  } else {
    for (const [name, command] of Object.entries(contract.required_root_scripts)) {
      if (!name || typeof command !== "string" || command.trim() === "") {
        violations.push("required_root_scripts entries require a name and command");
      }
    }
  }

  return [...new Set(violations)].sort();
}

export function collectRepositoryPaths({ cwd = repoRoot } = {}) {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.error) throw new Error(`Unable to inspect repository paths: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ls-files failed with code ${result.status}: ${(result.stderr ?? "").trim()}`);
  }
  return String(result.stdout ?? "")
    .split("\0")
    .map(normalizeRepositoryPath)
    .filter(Boolean)
    .sort();
}

export function validateTopLevelPaths(repositoryPaths, contract) {
  const violations = [];
  const allowedDirectories = new Set(contract.top_level.allowed_directories);
  const allowedFiles = new Set(contract.top_level.allowed_files);
  const pathSet = new Set(repositoryPaths);

  for (const repositoryPath of repositoryPaths) {
    const segments = repositoryPath.split("/");
    if (segments.length === 1) {
      if (!allowedFiles.has(repositoryPath)) {
        violations.push(`unexpected top-level file: ${repositoryPath}`);
      }
    } else if (!allowedDirectories.has(segments[0])) {
      violations.push(`unexpected top-level directory: ${segments[0]}`);
    }
  }

  for (const requiredFile of contract.top_level.required_files) {
    if (!pathSet.has(requiredFile)) violations.push(`missing required top-level file: ${requiredFile}`);
  }
  for (const requiredDirectory of contract.top_level.required_directories) {
    if (!repositoryPaths.some((repositoryPath) => repositoryPath.startsWith(`${requiredDirectory}/`))) {
      violations.push(`missing required top-level directory: ${requiredDirectory}`);
    }
  }
  return [...new Set(violations)].sort();
}

function repositoryAbsolutePath(repositoryRoot, relativePath) {
  const normalized = normalizeRepositoryPath(relativePath);
  const absolutePath = path.resolve(repositoryRoot, ...normalized.split("/"));
  const relative = path.relative(repositoryRoot, absolutePath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Repository path escapes root: ${relativePath}`);
  }
  return absolutePath;
}

function readJson(absolutePath) {
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function expandWorkspacePattern(repositoryRoot, pattern) {
  const normalized = normalizeRepositoryPath(pattern);
  if (!normalized.includes("*")) {
    const packagePath = repositoryAbsolutePath(repositoryRoot, normalized);
    return existsSync(path.join(packagePath, "package.json")) ? [normalized] : [];
  }
  if (!normalized.endsWith("/*") || normalized.slice(0, -2).includes("*")) {
    throw new Error(`Unsupported workspace pattern: ${pattern}`);
  }
  const parentRelative = normalized.slice(0, -2);
  const parentAbsolute = repositoryAbsolutePath(repositoryRoot, parentRelative);
  if (!existsSync(parentAbsolute) || !statSync(parentAbsolute).isDirectory()) return [];
  return readdirSync(parentAbsolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${parentRelative}/${entry.name}`)
    .filter((candidate) => existsSync(path.join(repositoryRoot, candidate, "package.json")))
    .sort();
}

export function validateNpmWorkspaces({ repositoryRoot, repositoryPaths, contract }) {
  const violations = [];
  const manifestPath = repositoryAbsolutePath(repositoryRoot, contract.npm.manifest);
  if (!existsSync(manifestPath)) return [`missing npm workspace manifest: ${contract.npm.manifest}`];
  const manifest = readJson(manifestPath);
  if (manifest.private !== true) violations.push("root package.json must remain private");
  if (!Array.isArray(manifest.workspaces)) {
    violations.push("root package.json workspaces must be an array");
    return violations;
  }

  if (JSON.stringify(manifest.workspaces) !== JSON.stringify(contract.npm.workspace_patterns)) {
    violations.push(
      `npm workspace patterns differ from contract: expected ${JSON.stringify(contract.npm.workspace_patterns)}, received ${JSON.stringify(manifest.workspaces)}`,
    );
  }
  for (const forbiddenPattern of contract.npm.forbidden_workspace_patterns) {
    if (manifest.workspaces.includes(forbiddenPattern)) {
      violations.push(`forbidden npm workspace pattern: ${forbiddenPattern}`);
    }
  }

  const discovered = new Set();
  for (const pattern of contract.npm.workspace_patterns) {
    let matches = [];
    try {
      matches = expandWorkspacePattern(repositoryRoot, pattern);
    } catch (error) {
      violations.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (matches.length === 0) violations.push(`npm workspace pattern matches no package: ${pattern}`);
    for (const match of matches) discovered.add(match);
  }

  const expectedPaths = contract.npm.packages.map((packageEntry) => packageEntry.path).sort();
  const discoveredPaths = [...discovered].sort();
  if (JSON.stringify(discoveredPaths) !== JSON.stringify(expectedPaths)) {
    violations.push(
      `resolved npm workspaces differ from contract: expected ${JSON.stringify(expectedPaths)}, received ${JSON.stringify(discoveredPaths)}`,
    );
  }

  const packageNames = new Set();
  for (const packageEntry of contract.npm.packages) {
    const packageManifestPath = path.join(
      repositoryAbsolutePath(repositoryRoot, packageEntry.path),
      "package.json",
    );
    if (!existsSync(packageManifestPath)) {
      violations.push(`missing workspace package.json: ${packageEntry.path}/package.json`);
      continue;
    }
    const packageManifest = readJson(packageManifestPath);
    if (packageManifest.name !== packageEntry.name) {
      violations.push(
        `workspace package name mismatch at ${packageEntry.path}: expected ${packageEntry.name}, received ${packageManifest.name ?? "<missing>"}`,
      );
    }
    if (packageManifest.private !== packageEntry.private) {
      violations.push(`workspace private flag mismatch at ${packageEntry.path}`);
    }
    if (packageNames.has(packageManifest.name)) {
      violations.push(`duplicate workspace package name: ${packageManifest.name}`);
    }
    packageNames.add(packageManifest.name);
  }

  const expectedManifests = new Set(
    contract.npm.packages.map((packageEntry) => `${packageEntry.path}/package.json`),
  );
  for (const repositoryPath of repositoryPaths) {
    if (
      (repositoryPath.startsWith("apps/") || repositoryPath.startsWith("services/")) &&
      repositoryPath.endsWith("/package.json") &&
      !expectedManifests.has(repositoryPath)
    ) {
      violations.push(`orphan application or service package.json: ${repositoryPath}`);
    }
  }

  for (const pythonServiceRoot of contract.npm.python_service_roots) {
    const absoluteRoot = repositoryAbsolutePath(repositoryRoot, pythonServiceRoot);
    if (!existsSync(absoluteRoot) || !statSync(absoluteRoot).isDirectory()) {
      violations.push(`missing Python service root: ${pythonServiceRoot}`);
    }
    if (existsSync(path.join(absoluteRoot, "package.json"))) {
      violations.push(`Python service must not become an npm workspace: ${pythonServiceRoot}`);
    }
    if (discovered.has(pythonServiceRoot)) {
      violations.push(`Python service resolved as npm workspace: ${pythonServiceRoot}`);
    }
  }

  for (const [scriptName, command] of Object.entries(contract.required_root_scripts)) {
    if (manifest.scripts?.[scriptName] !== command) {
      violations.push(`root script ${scriptName} must equal: ${command}`);
    }
  }

  return [...new Set(violations)].sort();
}

export function validateZones({ repositoryRoot, contract }) {
  const violations = [];
  for (const zone of contract.zones) {
    const zoneAbsolute = repositoryAbsolutePath(repositoryRoot, zone.path);
    if (!existsSync(zoneAbsolute) || !statSync(zoneAbsolute).isDirectory()) {
      violations.push(`missing repository zone: ${zone.path}`);
    }
    const boundaryAbsolute = repositoryAbsolutePath(repositoryRoot, zone.boundary_document);
    if (!existsSync(boundaryAbsolute) || !statSync(boundaryAbsolute).isFile()) {
      violations.push(`missing boundary document for ${zone.path}: ${zone.boundary_document}`);
    }
    for (const requiredPath of zone.required_paths) {
      if (!existsSync(repositoryAbsolutePath(repositoryRoot, requiredPath))) {
        violations.push(`missing required path for ${zone.path}: ${requiredPath}`);
      }
    }
    for (const governancePath of zone.governance_paths) {
      if (!existsSync(repositoryAbsolutePath(repositoryRoot, governancePath))) {
        violations.push(`missing governance path for ${zone.path}: ${governancePath}`);
      }
    }
  }
  return [...new Set(violations)].sort();
}

export function validateStatusDocuments({ repositoryRoot, contract }) {
  const violations = [];
  for (const document of contract.status_documents) {
    const absolutePath = repositoryAbsolutePath(repositoryRoot, document.path);
    if (!existsSync(absolutePath)) {
      violations.push(`missing status document: ${document.path}`);
      continue;
    }
    const contents = readFileSync(absolutePath, "utf8");
    for (const marker of document.required_markers) {
      if (!contents.includes(marker)) {
        violations.push(`status document ${document.path} is missing marker: ${marker}`);
      }
    }
  }
  return [...new Set(violations)].sort();
}

function localMarkdownTargets(contents) {
  const targets = [];
  for (const match of contents.matchAll(LOCAL_LINK_PATTERN)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    const titleOffset = target.search(/\s+["']/u);
    if (titleOffset >= 0) target = target.slice(0, titleOffset);
    if (
      !target ||
      target.startsWith("#") ||
      /^(?:https?:|mailto:|tel:|data:)/iu.test(target) ||
      target.includes("${{")
    ) {
      continue;
    }
    const pathOnly = target.split("#", 1)[0].split("?", 1)[0];
    if (pathOnly) targets.push(pathOnly);
  }
  return targets;
}

export function validateMarkdownDocuments({ repositoryRoot, contract }) {
  const violations = [];
  for (const documentPath of contract.markdown_documents) {
    const absoluteDocument = repositoryAbsolutePath(repositoryRoot, documentPath);
    if (!existsSync(absoluteDocument)) {
      violations.push(`missing governed markdown document: ${documentPath}`);
      continue;
    }
    const contents = readFileSync(absoluteDocument, "utf8");
    for (const target of localMarkdownTargets(contents)) {
      let decodedTarget = target;
      try {
        decodedTarget = decodeURIComponent(target);
      } catch {
        violations.push(`invalid encoded markdown link in ${documentPath}: ${target}`);
        continue;
      }
      const absoluteTarget = decodedTarget.startsWith("/")
        ? repositoryAbsolutePath(repositoryRoot, decodedTarget.slice(1))
        : path.resolve(path.dirname(absoluteDocument), decodedTarget);
      const relativeTarget = path.relative(repositoryRoot, absoluteTarget);
      if (
        relativeTarget === ".." ||
        relativeTarget.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeTarget)
      ) {
        violations.push(`markdown link escapes repository in ${documentPath}: ${target}`);
      } else if (!existsSync(absoluteTarget)) {
        violations.push(`broken local markdown link in ${documentPath}: ${target}`);
      }
    }
  }
  return [...new Set(violations)].sort();
}

export function checkRepositoryStructure({
  repositoryRoot = repoRoot,
  contractPath = defaultContractPath,
  quiet = false,
} = {}) {
  const contract = readJson(contractPath);
  const violations = validateRepositoryStructureContract(contract);
  const repositoryPaths = collectRepositoryPaths({ cwd: repositoryRoot });
  violations.push(...validateTopLevelPaths(repositoryPaths, contract));
  violations.push(...validateNpmWorkspaces({ repositoryRoot, repositoryPaths, contract }));
  violations.push(...validateZones({ repositoryRoot, contract }));
  violations.push(...validateStatusDocuments({ repositoryRoot, contract }));
  violations.push(...validateMarkdownDocuments({ repositoryRoot, contract }));

  if (violations.length > 0) throw new RepositoryStructureError(violations);

  const report = {
    paths_checked: repositoryPaths.length,
    workspaces: contract.npm.packages.map((packageEntry) => packageEntry.path),
    zones: contract.zones.length,
    markdown_documents: contract.markdown_documents.length,
  };
  if (!quiet) {
    console.log(
      `[repository-structure] passed (${report.paths_checked} paths; ${report.workspaces.length} npm workspaces; ${report.zones} zones; ${report.markdown_documents} linked documents)`,
    );
  }
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    checkRepositoryStructure();
  } catch (error) {
    if (error instanceof RepositoryStructureError) {
      console.error(error.message);
      for (const violation of error.violations) console.error(`- ${violation}`);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}
