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
    dataset: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--report" || argument === "--dataset") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  options.dataset ??= path.join(
    options.root,
    "contracts",
    "golden-dataset",
    "mei-xiang-family.v1.json",
  );
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
    requireCondition(actual[field] === value, `${label} ${field} drifted: expected ${value}; got ${actual[field]}`);
  }
}

function walkPublicValue(value, contract, location = "public") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkPublicValue(item, contract, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    requireCondition(
      contract.allowed_public_keys.includes(key),
      `${location}.${key} is not in the public-field allowlist`,
    );
    requireCondition(!contract.forbidden_public_keys.includes(key), `${location}.${key} is forbidden in public output`);
    const normalizedKey = key.toLowerCase();
    requireCondition(
      !contract.forbidden_public_key_markers.some((marker) => normalizedKey.includes(marker)),
      `${location}.${key} matches a forbidden public-field marker`,
    );
    requireCondition(
      !contract.geometry_only_public_keys.includes(key) || location.endsWith(".geometry"),
      `${location}.${key} is only allowed inside GeoJSON geometry`,
    );
    walkPublicValue(child, contract, `${location}.${key}`);
  }
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  requireCondition(!quoted, "pandas.csv contains an unterminated quoted field");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function parseD1Release(d1) {
  const matches = [
    ...d1.matchAll(/insert into public_releases\s*\([^)]*\)\s*values\s*\(\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'/g),
  ];
  requireCondition(matches.length === 1, `d1.sql must define exactly one public release; got ${matches.length}`);
  return {
    dataset_release_version: matches[0][1],
    public_schema_version: matches[0][2],
    database_migration_version: matches[0][3],
  };
}

function parseD1Records(d1) {
  const prefix = "insert into public_release_records ";
  const declaredRecordCount = d1.match(/\bpublic_release_records\b/gi)?.length ?? 0;
  const records = d1
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix))
    .map((line, index) => {
      const match = line.match(/values \('([^']*)', '([^']*)', '([^']*)', '((?:''|[^'])*)'\);$/);
      requireCondition(match, `d1.sql public release record ${index + 1} is malformed`);
      let publicValue;
      try {
        publicValue = JSON.parse(match[4].replaceAll("''", "'"));
      } catch (error) {
        throw new Error(`d1.sql public release record ${match[3]} has invalid JSON: ${String(error)}`);
      }
      return {
        dataset_release_version: match[1],
        entity_type: match[2],
        entity_id: match[3],
        public: publicValue,
      };
    });
  requireCondition(
    records.length === declaredRecordCount,
    `d1.sql contains ${declaredRecordCount - records.length} non-canonical public release record insert(s)`,
  );
  return records;
}

function coordinatePositions(value) {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && value.slice(0, 2).every((item) => typeof item === "number")) {
    return [[value[0], value[1]]];
  }
  return value.flatMap(coordinatePositions);
}

function assertSafeWildFeature(feature, label) {
  if (feature.properties?.layer !== "wild") return;
  requireCondition(
    new Set(["Polygon", "MultiPolygon"]).has(feature.geometry?.type),
    `${label} wild distribution feature ${feature.id ?? "unknown"} is not aggregated`,
  );
  const positions = coordinatePositions(feature.geometry?.coordinates);
  requireCondition(
    positions.length > 0,
    `${label} wild distribution feature ${feature.id ?? "unknown"} has no coordinates`,
  );
  const longitudeSpan = Math.max(...positions.map((item) => item[0])) - Math.min(...positions.map((item) => item[0]));
  const latitudeSpan = Math.max(...positions.map((item) => item[1])) - Math.min(...positions.map((item) => item[1]));
  requireCondition(
    longitudeSpan >= 0.05 && latitudeSpan >= 0.05,
    `${label} wild distribution feature ${feature.id ?? "unknown"} is too precise for publication`,
  );
  for (const position of positions.flat()) {
    requireCondition(
      Math.abs(position * 1000 - Math.round(position * 1000)) < 1e-8,
      `${label} wild distribution feature ${feature.id ?? "unknown"} contains over-precise coordinates`,
    );
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
  const releaseDir = path.join(root, "data", "public-releases", dataset.dataset.version);
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
    requireCondition(content.byteLength === descriptor.bytes, `${filename} byte count does not match manifest`);
    requireCondition(sha256(content) === descriptor.sha256, `${filename} SHA-256 does not match manifest`);
  }

  const api = await readJson(path.join(releaseDir, "api.json"));
  const pandas = await readJson(path.join(releaseDir, "pandas.json"));
  requireSameRelease(releaseFields(api.release), expected, "api.json");
  requireSameRelease(releaseFields(pandas.release), expected, "pandas.json");

  const csvRows = parseCsv(await readFile(path.join(releaseDir, "pandas.csv"), "utf8"));
  const csvHeader = csvRows[0] ?? [];
  const datasetIndex = csvHeader.indexOf("dataset_release_version");
  const schemaIndex = csvHeader.indexOf("public_schema_version");
  const publicJsonIndex = csvHeader.indexOf("public_json");
  requireCondition(
    datasetIndex >= 0 && schemaIndex >= 0 && publicJsonIndex >= 0,
    "pandas.csv release metadata or public_json columns are missing",
  );
  const csvPublicValues = [];
  for (const [index, row] of csvRows.slice(1).entries()) {
    requireCondition(row.length === csvHeader.length, `pandas.csv row ${index + 2} has the wrong column count`);
    requireCondition(
      row[datasetIndex] === expected.dataset_release_version,
      `pandas.csv row ${index + 2} dataset release drifted`,
    );
    requireCondition(
      row[schemaIndex] === expected.public_schema_version,
      `pandas.csv row ${index + 2} Public Schema drifted`,
    );
    try {
      csvPublicValues.push(JSON.parse(row[publicJsonIndex]));
    } catch (error) {
      throw new Error(`pandas.csv row ${index + 2} has invalid public_json: ${String(error)}`);
    }
  }
  const d1 = await readFile(path.join(releaseDir, "d1.sql"), "utf8");
  requireSameRelease(parseD1Release(d1), expected, "d1.sql release registry");
  const d1Records = parseD1Records(d1);
  requireCondition(d1Records.length > 0, "d1.sql contains no public release records");
  for (const record of d1Records) {
    requireCondition(
      record.dataset_release_version === expected.dataset_release_version,
      `d1.sql ${record.entity_type}/${record.entity_id} dataset release drifted`,
    );
  }
  return { releaseDir, manifest, api, pandas, csvPublicValues, d1Records };
}

async function assertPublicDataBoundary(release, contract) {
  walkPublicValue(release.api, contract, "api.json");
  walkPublicValue(release.pandas, contract, "pandas.json");
  release.csvPublicValues.forEach((value, index) =>
    walkPublicValue(value, contract, `pandas.csv[${index + 2}].public_json`),
  );
  release.d1Records.forEach((record) =>
    walkPublicValue(record.public, contract, `d1.sql.${record.entity_type}.${record.entity_id}`),
  );
  const serializedFiles = await Promise.all(
    (await listFiles(release.releaseDir)).map((filename) => readFile(filename, "utf8")),
  );
  const serialized = serializedFiles.join("\n");
  for (const key of contract.forbidden_public_keys) {
    requireCondition(!serialized.includes(key), `public release contains forbidden marker ${key}`);
  }
  requireCondition(
    !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(serialized),
    "public release contains a personal email address",
  );
  (release.api.distribution?.features ?? []).forEach((feature) => assertSafeWildFeature(feature, "api.json"));
  release.d1Records
    .filter((record) => record.entity_type === "api_distribution")
    .forEach((record) => assertSafeWildFeature(record.public, "d1.sql"));
}

function assertReviewedSource(source, allowedStates, label) {
  requireCondition(source, `${label} references a missing source`);
  requireCondition(source.publication_status === "published", `${label} source ${source.id} is not published`);
  requireCondition(
    allowedStates.has(source.public.access_state),
    `${label} source ${source.id} is not reviewed and accessible`,
  );
  requireCondition(
    /^\d{4}-\d{2}-\d{2}$/.test(source.public.last_verified_at),
    `${label} source ${source.id} has no verification date`,
  );
}

function assertExpandedArchive(dataset) {
  requireCondition(dataset?.contract_version === "1.0.0", "expanded dataset contract_version must be 1.0.0");
  requireCondition(dataset?.dataset?.id === "panda-atlas-public", "expanded dataset id must be panda-atlas-public");
  requireCondition(
    dataset.dataset.base_dataset_version === "2026.07.18.1",
    "expanded dataset must declare the reviewed golden base version",
  );
  requireCondition(Array.isArray(dataset.dataset.expansion_panda_ids), "expanded dataset must declare expansion_panda_ids");
  for (const collection of [
    "sources", "facilities", "institutions", "places", "pandas", "facts",
    "parentage_assertions", "residencies", "events", "media",
  ]) {
    requireCondition(Array.isArray(dataset[collection]), `expanded dataset is missing ${collection}`);
  }
  const publishedPandas = new Map(
    dataset.pandas
      .filter((item) => item.publication_status === "published")
      .map((item) => [item.id, item]),
  );
  for (const pandaId of dataset.dataset.expansion_panda_ids) {
    const panda = publishedPandas.get(pandaId);
    requireCondition(panda, `expanded panda ${pandaId} is not published`);
    const approvedLocales = new Set(
      (panda.public.content ?? [])
        .filter((item) => item.translation_status === "approved")
        .map((item) => item.locale),
    );
    requireCondition(
      approvedLocales.has("zh-CN") && approvedLocales.has("en"),
      `${panda.public.canonical_slug} requires approved Chinese and English content`,
    );
    const factFields = new Set(
      dataset.facts
        .filter(
          (item) =>
            item.publication_status === "published" &&
            item.public.subject_id === pandaId &&
            item.public.conclusion_status === "confirmed",
        )
        .map((item) => item.public.field),
    );
    requireCondition(factFields.has("sex"), `${panda.public.canonical_slug} has no confirmed sex fact`);
    requireCondition(factFields.has("birth_date"), `${panda.public.canonical_slug} has no confirmed birth fact`);
    requireCondition(
      factFields.has("current_facility") || factFields.has("current_coarse_location"),
      `${panda.public.canonical_slug} has no confirmed current-place fact`,
    );
    const eventCount = dataset.events.filter(
      (item) => item.publication_status === "published" && item.public.participants?.includes(pandaId),
    ).length;
    requireCondition(eventCount >= 3, `${panda.public.canonical_slug} requires at least three reviewed events`);
    const mediaCount = dataset.media.filter(
      (item) =>
        item.publication_status === "published" &&
        item.public.panda_id === pandaId &&
        item.public.status === "available",
    ).length;
    requireCondition(mediaCount >= 1, `${panda.public.canonical_slug} requires an available reviewed photo`);
  }
}

function assertTrustedArchive(dataset, contract) {
  const isGoldenBaseline = dataset?.dataset?.id === "mei-xiang-family";
  if (isGoldenBaseline) {
    const report = validateGoldenDataset(dataset);
    requireCondition(report.valid, `golden dataset is invalid: ${JSON.stringify(report.errors)}`);
  } else {
    assertExpandedArchive(dataset);
  }
  const publicPandas = dataset.pandas.filter((item) => item.publication_status === "published");
  requireCondition(publicPandas.length === dataset.dataset.core_panda_count, "published core panda count drifted");
  const expectedParentage = [...contract.expected_confirmed_parentage_assertion_ids].sort();
  const confirmedParentage = dataset.parentage_assertions
    .filter((item) => item.publication_status === "published" && item.public.status === "confirmed")
    .sort((left, right) => left.id.localeCompare(right.id));
  const confirmedParentageIds = new Set(confirmedParentage.map((item) => item.id));
  for (const assertionId of expectedParentage) {
    requireCondition(confirmedParentageIds.has(assertionId), `required confirmed parentage ${assertionId} is missing`);
  }
  if (isGoldenBaseline) {
    requireCondition(
      confirmedParentage.length === expectedParentage.length,
      `golden confirmed parentage set drifted: expected ${expectedParentage.length}; got ${confirmedParentage.length}`,
    );
  }
  const sources = new Map(dataset.sources.map((source) => [source.id, source]));
  const allowedStates = new Set(contract.allowed_reviewed_source_states);
  const confirmedFacts = dataset.facts.filter(
    (item) => item.publication_status === "published" && item.public.conclusion_status === "confirmed",
  );
  for (const fact of confirmedFacts) {
    requireCondition(
      /^\d{4}-\d{2}-\d{2}$/.test(fact.public.last_verified_at),
      `${fact.id} confirmed fact is unverified`,
    );
    requireCondition(fact.public.source_ids.length > 0, `${fact.id} confirmed fact has no reviewed source`);
    fact.public.source_ids.forEach((sourceId) => assertReviewedSource(sources.get(sourceId), allowedStates, fact.id));
  }
  for (const assertion of confirmedParentage) {
    requireCondition(assertion.public.source_ids.length > 0, `${assertion.id} has no reviewed source`);
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
      assertReviewedSource(sources.get(sourceId), allowedStates, `${panda.public.canonical_slug} residency`),
    );
  }
}

async function assertAdminTokenBoundary(root, contract) {
  const sourceFiles = await listFiles(path.join(root, "apps", "web"));
  const allowlist = new Set(contract.admin_token_server_source_allowlist);
  const candidates = sourceFiles.filter((filename) => /\.(?:html|js|json|mjs|rsc|ts|tsx|txt)$/.test(filename));
  for (const filename of candidates) {
    const content = await readFile(filename, "utf8");
    const relative = path.relative(root, filename).replaceAll("\\", "/");
    const isGenerated = relative.startsWith("apps/web/.next/");
    const isBrowserBuild =
      relative.startsWith("apps/web/.next/static/") ||
      (/^apps\/web\/\.next\/server\/app\//.test(relative) && /\.(?:html|rsc|txt)$/.test(relative));
    if (isGenerated && !isBrowserBuild) continue;
    if (!isGenerated && allowlist.has(relative)) continue;
    for (const marker of contract.forbidden_client_markers) {
      requireCondition(!content.includes(marker), `${relative} exposes forbidden client marker ${marker}`);
    }
  }
}

async function assertWaiverPolicy(root, contract) {
  const register = await readJson(path.join(root, "data", "beta-launch", "waivers.json"));
  requireCondition(register.policy_version === contract.version, "waiver policy version drifted");
  requireCondition(Array.isArray(register.waivers), "waiver register must contain a waivers array");
  const hardGates = new Set(contract.hard_gate_ids);
  for (const waiver of register.waivers) {
    requireCondition(!hardGates.has(waiver.gate_id), `hard gate ${waiver.gate_id} cannot be waived`);
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

export async function runBetaHardGatePreflight({ root, report, dataset }) {
  const contract = await readJson(path.join(root, "contracts", "beta-hard-gates.v1.json"));
  const datasetPath = dataset ?? path.join(root, "contracts", "golden-dataset", "mei-xiang-family.v1.json");
  const datasetState = await readJson(datasetPath);
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
    release = await assertReleaseIntegrity(root, datasetState, contract);
  });
  await runCheck("public-data-boundary", async () => {
    requireCondition(release, "release integrity must pass before public data checks");
    await assertPublicDataBoundary(release, contract);
  });
  await runCheck("trusted-archive", async () => assertTrustedArchive(datasetState, contract));
  await runCheck("admin-token-boundary", async () => assertAdminTokenBoundary(root, contract));
  await runCheck("waiver-policy", async () => assertWaiverPolicy(root, contract));
  const outcome = checks.every((check) => check.status === "passed") ? "passed" : "failed";
  const result = {
    outcome,
    dataset_release_version: datasetState.dataset.version,
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
    console.log(`BETA_HARD_GATE_RESULT outcome=${result.outcome} release=${result.dataset_release_version}`);
    for (const check of result.checks) {
      console.log(`[beta-hard-gates] ${check.status.padEnd(6)} ${check.id}${check.detail ? ` — ${check.detail}` : ""}`);
    }
    if (result.outcome !== "passed") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
