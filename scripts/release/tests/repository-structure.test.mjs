import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkRepositoryStructure,
  collectRepositoryPaths,
  validateMarkdownDocuments,
  validateNpmWorkspaces,
  validateRepositoryStructureContract,
  validateStatusDocuments,
  validateTopLevelPaths,
  validateZones,
} from "../check-repository-structure.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const contractPath = path.join(repoRoot, "contracts", "repository-structure.v1.json");
const contract = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(contractPath, "utf8")));

function cloneContract() {
  return structuredClone(contract);
}

test("tracked repository satisfies the structure contract", () => {
  assert.deepEqual(validateRepositoryStructureContract(contract), []);
  const report = checkRepositoryStructure({ repositoryRoot: repoRoot, quiet: true });
  assert.deepEqual(report.workspaces, ["apps/web", "services/worker-api"]);
  assert.equal(report.zones, 12);
  assert.equal(report.markdown_documents, 16);
});

test("contract shape rejects unknown fields and duplicate paths", () => {
  const changed = cloneContract();
  changed.unknown = true;
  changed.top_level.allowed_files.push(changed.top_level.allowed_files[0]);
  const violations = validateRepositoryStructureContract(changed);
  assert.ok(violations.includes("contract contains unknown field: unknown"));
  assert.ok(violations.some((item) => item.includes("top_level.allowed_files values must be unique")));
});

test("top-level policy rejects undeclared files and directories", () => {
  const repositoryPaths = collectRepositoryPaths({ cwd: repoRoot });
  const violations = validateTopLevelPaths(
    [...repositoryPaths, "temporary.txt", "packages/example/index.ts"],
    contract,
  );
  assert.ok(violations.includes("unexpected top-level file: temporary.txt"));
  assert.ok(violations.includes("unexpected top-level directory: packages"));
});

test("npm workspace policy rejects stale globs, name drift, and orphan manifests", () => {
  const repositoryPaths = collectRepositoryPaths({ cwd: repoRoot });
  const changed = cloneContract();
  changed.npm.workspace_patterns = ["apps/*", "packages/*", "services/worker-api"];
  changed.npm.forbidden_workspace_patterns = ["apps/*", "packages/*"];
  changed.npm.packages[0].name = "wrong-web-name";
  const violations = validateNpmWorkspaces({
    repositoryRoot: repoRoot,
    repositoryPaths: [...repositoryPaths, "apps/rogue/package.json"],
    contract: changed,
  });
  assert.ok(violations.some((item) => item.includes("npm workspace patterns differ")));
  assert.ok(violations.includes("forbidden npm workspace pattern: apps/*"));
  assert.ok(violations.includes("npm workspace pattern matches no package: packages/*"));
  assert.ok(violations.some((item) => item.includes("workspace package name mismatch at apps/web")));
  assert.ok(violations.includes("orphan application or service package.json: apps/rogue/package.json"));
});

test("zones fail closed when boundary or governance files disappear", () => {
  const changed = cloneContract();
  const appsZone = changed.zones.find((zone) => zone.path === "apps");
  assert.ok(appsZone);
  appsZone.boundary_document = "apps/MISSING.md";
  appsZone.governance_paths.push("docs/MISSING.md");
  const violations = validateZones({ repositoryRoot: repoRoot, contract: changed });
  assert.ok(violations.includes("missing boundary document for apps: apps/MISSING.md"));
  assert.ok(violations.includes("missing governance path for apps: docs/MISSING.md"));
});

test("status documents retain explicit runtime markers", () => {
  const changed = cloneContract();
  changed.status_documents[0].required_markers.push("Impossible runtime marker");
  const violations = validateStatusDocuments({ repositoryRoot: repoRoot, contract: changed });
  assert.ok(
    violations.includes(
      "status document docs/deployment/runtime-status.md is missing marker: Impossible runtime marker",
    ),
  );
});

test("governed markdown links cannot break or escape the repository", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "panda-repository-links-"));
  try {
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(
      path.join(root, "docs", "README.md"),
      "[missing](missing.md)\n[escape](../../outside.md)\n",
      "utf8",
    );
    const violations = validateMarkdownDocuments({
      repositoryRoot: root,
      contract: { markdown_documents: ["docs/README.md"] },
    });
    assert.ok(violations.includes("broken local markdown link in docs/README.md: missing.md"));
    assert.ok(violations.includes("markdown link escapes repository in docs/README.md: ../../outside.md"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
