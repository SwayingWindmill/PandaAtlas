import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { validateGoldenDataset } from "../golden-dataset/lib.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), "../..");

function parseArguments(argv) {
  const options = {
    root: defaultRoot,
    report: path.join(defaultRoot, ".release-gate", "beta-hard-gates.json"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--report") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function releaseFields(value) {
  return {
    database_migration_version: value.database_migration_version,
    dataset_release_version: value.dataset_release_version,
    public_schema_version: value.public_schema_version,
  };
}

function requireSameRelease(actual, expected, label) {
  for (const [field, value] of Object.entries(expected)) {
    requireCondition(
      actual[field] === value,
      `${label} ${field} drifted: expected ${value}; got ${actual[field]}`,
    );
  }
}

function walkPublicValue(value, forbiddenKeys, location = "public") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkPublicValue(item, forbiddenKeys, `${location}[${index}]`),
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    requireCondition(
      !forbiddenKeys.has(key),
      `${location}.${key} is forbidden in public output`,
    );
    walkPublicValue(child, forbiddenKeys, `${location}.${key}`);
  }
}

async function listFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...(await listFiles(filename)));
      else if (entry.isFile()) files.push(filename);
    }
    return files;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function assertReleaseIntegrity(root, dataset, contract) {
  const releaseDir = path.join(
    root,
    "data",
    "public-releases",
    dataset.dataset.version,
  );
  const manifest = await readJson(path.join(releaseDir, "manifest.json"));
  const manifestFiles = Object.keys(manifest.files ?? {}).sort();
  const requiredFiles = [...contract.required_release_files].sort();
  requireCondition(
    JSON.stringify(manifestFiles) === JSON.stringify(requiredFiles),
    `manifest file set drifted: expected ${requiredFiles.join(", ")}; got ${manifestFiles.join(", ")}`,
  );
  const expected = releaseFields(manifest);
  requireSameRelease(
    {
      database_migration_version: manifest.database_migration_version,
      dataset_release_version: dataset.dataset.version,
      public_schema_version: dataset.dataset.public_schema_version,
    },
    expected,
    "golden dataset",
  );

  for (const [filename, descriptor] of Object.entries(manifest.files)) {
    const content = await readFile(path.join(releaseDir, filename));
    requireCondition(
      content.byteLength === descriptor.bytes,
      `${filename} byte count does not match manifest`,
    );
    requireCondition(
      sha256(content) === descriptor.sha256,
      `${filename} SHA-256 does not match manifest`,
    );
  }

  const api = await readJson(path.join(releaseDir, "api.json"));
  const pandas = await readJson(path.join(releaseDir, "pandas.json"));
  requireSameRelease(releaseFields(api.release), expected, "api.json");
  requireSameRelease(releaseFields(pandas.release), expected, "pandas.json");

  const csv = await readFile(path.join(releaseDir, "pandas.csv"), "utf8");
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    requireCondition(
      line.includes(expected.dataset_release_version),
      "pandas.csv dataset release drifted",
    );
    requireCondition(
      line.includes(expected.public_schema_version),
      "pandas.csv Public Schema drifted",
    );
  }
  const d1 = await readFile(path.join(releaseDir, "d1.sql"), "utf8");
  requireCondition(
    d1.includes(expected.dataset_release_version),
    "d1.sql dataset release drifted",
  );
  requireCondition(
    d1.includes(expected.public_schema_version),
    "d1.sql Public Schema drifted",
  );
  requireCondition(
    d1.includes(expected.database_migration_version),
    "d1.sql migration version drifted",
  );
  return { releaseDir, manifest, api, pandas };
}

async function assertPublicDataBoundary(release, contract) {
  const forbiddenKeys = new Set(contract.forbidden_public_keys);
  walkPublicValue(release.api, forbiddenKeys, "api.json");
  walkPublicValue(release.pandas, forbiddenKeys, "pandas.json");
  const serializedFiles = await Promise.all(
    (await listFiles(release.releaseDir)).map((filename) =>
      readFile(filename, "utf8"),
    ),
  );
  const serialized = serializedFiles.join("\n");
  for (const key of forbiddenKeys) {
    requireCondition(
      !serialized.includes(key),
      `public release contains forbidden marker ${key}`,
    );
  }
  requireCondition(
    !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(serialized),
    "public release contains a personal email address",
  );
  for (const feature of release.api.distribution?.features ?? []) {
    if (feature.properties?.layer === "wild") {
      requireCondition(
        new Set(["Polygon", "MultiPolygon"]).has(feature.geometry?.type),
        `wild distribution feature ${feature.id ?? "unknown"} is not aggregated`,
      );
    }
  }
}

function assertReviewedSource(source, allowedStates, label) {
  requireCondition(source, `${label} references a missing source`);
  requireCondition(
    source.publication_status === "published",
    `${label} source ${source.id} is not published`,
  );
  requireCondition(
    allowedStates.has(source.public.access_state),
    `${label} source ${source.id} is not reviewed and accessible`,
  );
  requireCondition(
    /^\d{4}-\d{2}-\d{2}$/.test(source.public.last_verified_at),
    `${label} source ${source.id} has no verification date`,
  );
}

function assertTrustedArchive(dataset, contract) {
  const report = validateGoldenDataset(dataset);
  requireCondition(
    report.valid,
    `golden dataset is invalid: ${JSON.stringify(report.errors)}`,
  );
  const publicPandas = dataset.pandas.filter(
    (item) => item.publication_status === "published",
  );
  requireCondition(
    publicPandas.length === dataset.dataset.core_panda_count,
    "published core panda count drifted",
  );
  const expectedParentage = [
    ...contract.expected_confirmed_parentage_assertion_ids,
  ].sort();
  const confirmedParentage = dataset.parentage_assertions
    .filter(
      (item) =>
        item.publication_status === "published" &&
        item.public.status === "confirmed",
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  requireCondition(
    JSON.stringify(confirmedParentage.map((item) => item.id)) ===
      JSON.stringify(expectedParentage),
    `confirmed parentage set drifted: expected ${expectedParentage.join(", ")}; got ${confirmedParentage.map((item) => item.id).join(", ")}`,
  );
  const sources = new Map(dataset.sources.map((source) => [source.id, source]));
  const allowedStates = new Set(contract.allowed_reviewed_source_states);
  for (const assertion of confirmedParentage) {
    requireCondition(
      assertion.public.source_ids.length > 0,
      `${assertion.id} has no reviewed source`,
    );
    assertion.public.source_ids.forEach((sourceId) =>
      assertReviewedSource(sources.get(sourceId), allowedStates, assertion.id),
    );
  }
  for (const panda of publicPandas) {
    const current = dataset.residencies.filter(
      (item) =>
        item.publication_status === "published" &&
        item.public.panda_id === panda.id &&
        item.public.residency_type === "primary" &&
        item.public.end_date == null,
    );
    requireCondition(
      current.length === 1,
      `${panda.public.canonical_slug} must have exactly one current primary residency`,
    );
    requireCondition(
      /^\d{4}-\d{2}-\d{2}$/.test(current[0].public.last_verified_at),
      `${panda.public.canonical_slug} current residency is unverified`,
    );
    requireCondition(
      current[0].public.source_ids.length > 0,
      `${panda.public.canonical_slug} current residency has no source`,
    );
    current[0].public.source_ids.forEach((sourceId) =>
      assertReviewedSource(
        sources.get(sourceId),
        allowedStates,
        `${panda.public.canonical_slug} residency`,
      ),
    );
  }
}

async function assertAdminTokenBoundary(root, contract) {
  const sourceFiles = await listFiles(path.join(root, "apps", "web"));
  const candidates = sourceFiles.filter((filename) =>
    /\.(?:js|mjs|ts|tsx)$/.test(filename),
  );
  for (const filename of candidates) {
    const content = await readFile(filename, "utf8");
    const relative = path.relative(root, filename).replaceAll("\\", "/");
    const isClientSource = /(?:^|\r?\n)\s*["']use client["'];/.test(
      content.slice(0, 2048),
    );
    const isBrowserBuild = relative.startsWith("apps/web/.next/static/");
    if (!isClientSource && !isBrowserBuild) continue;
    for (const marker of contract.forbidden_client_markers) {
      requireCondition(
        !content.includes(marker),
        `${relative} exposes forbidden client marker ${marker}`,
      );
    }
  }
}

async function assertWaiverPolicy(root, contract) {
  const register = await readJson(
    path.join(root, "data", "beta-launch", "waivers.json"),
  );
  requireCondition(
    register.policy_version === contract.version,
    "waiver policy version drifted",
  );
  requireCondition(
    Array.isArray(register.waivers),
    "waiver register must contain a waivers array",
  );
  const hardGates = new Set(contract.hard_gate_ids);
  for (const waiver of register.waivers) {
    requireCondition(
      !hardGates.has(waiver.gate_id),
      `hard gate ${waiver.gate_id} cannot be waived`,
    );
    for (const field of contract.waiver_required_fields) {
      requireCondition(
        typeof waiver[field] === "string" && waiver[field].trim(),
        `waiver ${waiver.gate_id ?? "unknown"} is missing ${field}`,
      );
    }
    requireCondition(
      /^\d{4}-\d{2}-\d{2}$/.test(waiver.deadline),
      `waiver ${waiver.gate_id} deadline must be YYYY-MM-DD`,
    );
  }
}

export async function runBetaHardGatePreflight({ root, report }) {
  const contract = await readJson(
    path.join(root, "contracts", "beta-hard-gates.v1.json"),
  );
  const dataset = await readJson(
    path.join(root, "contracts", "golden-dataset", "mei-xiang-family.v1.json"),
  );
  const checks = [];
  let release;
  const runCheck = async (id, action) => {
    try {
      await action();
      checks.push({ id, status: "passed" });
    } catch (error) {
      checks.push({
        id,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };
  await runCheck("release-integrity", async () => {
    release = await assertReleaseIntegrity(root, dataset, contract);
  });
  await runCheck("public-data-boundary", async () => {
    requireCondition(
      release,
      "release integrity must pass before public data checks",
    );
    await assertPublicDataBoundary(release, contract);
  });
  await runCheck("trusted-archive", async () =>
    assertTrustedArchive(dataset, contract),
  );
  await runCheck("admin-token-boundary", async () =>
    assertAdminTokenBoundary(root, contract),
  );
  await runCheck("waiver-policy", async () =>
    assertWaiverPolicy(root, contract),
  );
  const outcome = checks.every((check) => check.status === "passed")
    ? "passed"
    : "failed";
  const result = {
    outcome,
    dataset_release_version: dataset.dataset.version,
    generated_at: new Date().toISOString(),
    checks,
  };
  await mkdir(path.dirname(report), { recursive: true });
  await writeFile(report, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

if (process.argv[1] === scriptPath) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = await runBetaHardGatePreflight(options);
    console.log(
      `BETA_HARD_GATE_RESULT outcome=${result.outcome} release=${result.dataset_release_version}`,
    );
    for (const check of result.checks) {
      console.log(
        `[beta-hard-gates] ${check.status.padEnd(6)} ${check.id}${check.detail ? ` — ${check.detail}` : ""}`,
      );
    }
    if (result.outcome !== "passed") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
