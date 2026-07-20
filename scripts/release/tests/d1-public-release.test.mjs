import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildActivationPreflightSql,
  buildD1ImportBatchSql,
  buildRollbackUpdateSql,
  expectedPublicRecordCount,
  inspectPublicReleaseArtifact,
  parseCommonD1Arguments,
  rowsFromWranglerJson,
  sha256,
  validateActivationPreflight,
  validateActivationVerification,
  validateRollbackPreflight,
  validateRollbackVerification,
  wranglerExecuteArguments,
  wranglerResultsFromJson,
} from "../d1-public-release.mjs";

const TARGET_VERSION = "2026.07.20.2";
const ROLLBACK_VERSION = "2026.07.20.1";

function minimalReleaseSql(version = TARGET_VERSION, tail = "") {
  return `begin immediate;
insert into public_releases (
  dataset_release_version, public_schema_version, database_migration_version,
  publication_batch_id, projection_code_version, released_at, licenses_json
) values (
  '${version}', '1.2.0', '0007', 'test-batch', 'public-release-v4', '2026-07-20T10:15:00Z', '{}'
);
insert into public_release_records (dataset_release_version, entity_type, entity_id, public_json)
values ('${version}', 'api_pandas', 'panda-1', '{}');
update public_release_pointer
set dataset_release_version = '${version}', switched_at = '2026-07-20T10:15:00Z'
where singleton = 1;
${tail}commit;
`;
}

function syntheticManifest(sqlBuffer, overrides = {}) {
  return {
    database_migration_version: "0007",
    dataset_release_version: TARGET_VERSION,
    files: {
      "d1.sql": {
        bytes: sqlBuffer.byteLength,
        sha256: sha256(sqlBuffer),
      },
    },
    projection_code_version: "public-release-v4",
    public_schema_version: "1.2.0",
    publication_batch_id: "test-batch",
    record_counts: {
      api_pandas: 1,
      facts: 2,
    },
    released_at: "2026-07-20T10:15:00Z",
    ...overrides,
  };
}

test("prepares the tracked Ueno release as a D1-compatible rollback-safe batch", () => {
  const artifact = inspectPublicReleaseArtifact(TARGET_VERSION);

  assert.equal(artifact.expectedRecords, 198);
  assert.equal(artifact.expectedApiPandas, 14);
  assert.equal(artifact.sqlBytes, 203865);
  assert.equal(
    artifact.sqlSha256,
    "0b259cfb1d0e77cabb8895fc8a58ff61a38e55e3a66d51c3d43e166c200aca50",
  );
  assert.doesNotMatch(artifact.batchSql, /^\s*begin\b/i);
  assert.doesNotMatch(artifact.batchSql, /\bcommit\s*;\s*$/i);
  assert.match(
    artifact.batchSql,
    /update public_release_pointer[\s\S]*dataset_release_version = '2026\.07\.20\.2'[\s\S]*where singleton = 1;\s*$/,
  );
});

test("removes only the reviewed outer transaction envelope", () => {
  const batchSql = buildD1ImportBatchSql(minimalReleaseSql(), TARGET_VERSION);

  assert.match(batchSql, /^insert into public_releases/);
  assert.doesNotMatch(batchSql, /^\s*begin\b/i);
  assert.doesNotMatch(batchSql, /\bcommit\s*;\s*$/i);
  assert.match(batchSql, /update public_release_pointer/);
});

test("rejects unsafe D1 release SQL envelopes and pointer ordering", () => {
  assert.throws(
    () => buildD1ImportBatchSql(minimalReleaseSql().replace("begin immediate;\n", ""), TARGET_VERSION),
    /start with BEGIN IMMEDIATE/,
  );
  assert.throws(
    () => buildD1ImportBatchSql(minimalReleaseSql().replace("commit;\n", ""), TARGET_VERSION),
    /end with COMMIT/,
  );
  assert.throws(
    () => buildD1ImportBatchSql(
      minimalReleaseSql().replace(
        "insert into public_release_records",
        "savepoint unsafe;\ninsert into public_release_records",
      ),
      TARGET_VERSION,
    ),
    /unexpected explicit transaction statement/,
  );
  assert.throws(
    () => buildD1ImportBatchSql(minimalReleaseSql(TARGET_VERSION, "select 1;\n"), TARGET_VERSION),
    /pointer update must target the candidate release and remain the final statement/,
  );
  assert.throws(
    () => buildD1ImportBatchSql(minimalReleaseSql("2026.07.20.3"), TARGET_VERSION),
    /pointer update must target the candidate release/,
  );
});

test("validates manifest identity, byte size, SHA-256, and record counts", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "pandaatlas-public-release-"));
  try {
    const sqlBuffer = Buffer.from(minimalReleaseSql(), "utf8");
    writeFileSync(path.join(directory, "d1.sql"), sqlBuffer);
    writeFileSync(
      path.join(directory, "manifest.json"),
      `${JSON.stringify(syntheticManifest(sqlBuffer), null, 2)}\n`,
      "utf8",
    );

    const artifact = inspectPublicReleaseArtifact(TARGET_VERSION, directory);
    assert.equal(artifact.expectedRecords, 3);

    const changed = Buffer.from(sqlBuffer);
    changed[changed.length - 10] = changed[changed.length - 10] === 32 ? 33 : 32;
    writeFileSync(path.join(directory, "d1.sql"), changed);
    assert.throws(
      () => inspectPublicReleaseArtifact(TARGET_VERSION, directory),
      /SHA-256 drift/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects invalid manifest record counts", () => {
  assert.equal(expectedPublicRecordCount({ record_counts: { pandas: 2, media: 3 } }), 5);
  assert.throws(
    () => expectedPublicRecordCount({ record_counts: { pandas: -1 } }),
    /Invalid record count/,
  );
  assert.throws(
    () => expectedPublicRecordCount({}),
    /missing record_counts/,
  );
});

test("parses Wrangler query and update JSON without assuming update rows", () => {
  const queryJson = JSON.stringify([
    { success: true, results: [{ current_release: ROLLBACK_VERSION }], meta: { changes: 0 } },
  ]);
  assert.deepEqual(rowsFromWranglerJson(queryJson), [{ current_release: ROLLBACK_VERSION }]);

  const updateJson = JSON.stringify([
    { success: true, results: [], meta: { changes: 1 } },
  ]);
  assert.equal(wranglerResultsFromJson(updateJson)[0].meta.changes, 1);
  assert.deepEqual(rowsFromWranglerJson(updateJson), []);
  assert.throws(
    () => wranglerResultsFromJson(JSON.stringify([{ success: false, results: [] }])),
    /unsuccessful D1 result/,
  );
});

test("activation preflight fails closed for duplicate or incomplete state", () => {
  const validRow = {
    current_release: ROLLBACK_VERSION,
    target_release_rows: 0,
    target_record_rows: 0,
    target_whole_withdrawals: 0,
    rollback_release_rows: 1,
    rollback_record_rows: 138,
  };
  assert.deepEqual(validateActivationPreflight(validRow, TARGET_VERSION), {
    currentRelease: ROLLBACK_VERSION,
    rollbackReleaseRows: 1,
    rollbackRecordRows: 138,
  });
  assert.match(buildActivationPreflightSql(TARGET_VERSION), /target_record_rows/);

  assert.throws(
    () => validateActivationPreflight({ ...validRow, current_release: TARGET_VERSION }, TARGET_VERSION),
    /already current/,
  );
  assert.throws(
    () => validateActivationPreflight({ ...validRow, target_release_rows: 1 }, TARGET_VERSION),
    /already has D1 state/,
  );
  assert.throws(
    () => validateActivationPreflight({ ...validRow, target_record_rows: 12 }, TARGET_VERSION),
    /already has D1 state/,
  );
  assert.throws(
    () => validateActivationPreflight({ ...validRow, rollback_record_rows: 0 }, TARGET_VERSION),
    /rollback release.*incomplete/i,
  );
});

test("activation verification binds D1 metadata and counts to the manifest", () => {
  const artifact = {
    releaseVersion: TARGET_VERSION,
    expectedRecords: 198,
    expectedApiPandas: 14,
    manifest: {
      public_schema_version: "1.2.0",
      database_migration_version: "0007",
      publication_batch_id: "ueno-family-photo-batch",
      projection_code_version: "public-release-v4",
      released_at: "2026-07-20T10:15:00Z",
    },
  };
  const row = {
    current_release: TARGET_VERSION,
    target_release_rows: 1,
    target_record_rows: 198,
    target_api_pandas_rows: 14,
    target_public_schema_version: "1.2.0",
    target_database_migration_version: "0007",
    target_publication_batch_id: "ueno-family-photo-batch",
    target_projection_code_version: "public-release-v4",
    target_released_at: "2026-07-20T10:15:00Z",
    target_whole_withdrawals: 0,
    rollback_release_rows: 1,
    rollback_record_rows: 138,
  };

  assert.equal(
    validateActivationVerification(row, artifact, ROLLBACK_VERSION).rollbackRecordRows,
    138,
  );
  assert.throws(
    () => validateActivationVerification({ ...row, target_record_rows: 197 }, artifact, ROLLBACK_VERSION),
    /record count mismatch/,
  );
  assert.throws(
    () => validateActivationVerification({ ...row, target_public_schema_version: "9.0.0" }, artifact, ROLLBACK_VERSION),
    /metadata mismatch/,
  );
});

test("rollback is pointer-only, source-guarded, and rejects missing or withdrawn targets", () => {
  const validRow = {
    current_release: TARGET_VERSION,
    target_release_rows: 1,
    target_record_rows: 138,
    target_whole_withdrawals: 0,
  };
  assert.deepEqual(validateRollbackPreflight(validRow, ROLLBACK_VERSION), {
    currentRelease: TARGET_VERSION,
    targetVersion: ROLLBACK_VERSION,
    targetRecordRows: 138,
  });

  const sql = buildRollbackUpdateSql(
    TARGET_VERSION,
    ROLLBACK_VERSION,
    "2026-07-20T12:30:00.000Z",
  );
  assert.match(sql, /set dataset_release_version = '2026\.07\.20\.1'/);
  assert.match(sql, /and dataset_release_version = '2026\.07\.20\.2'/);
  assert.match(sql, /returning dataset_release_version, switched_at$/);
  assert.doesNotMatch(sql, /delete|insert/i);

  assert.throws(
    () => validateRollbackPreflight({ ...validRow, current_release: ROLLBACK_VERSION }, ROLLBACK_VERSION),
    /already current/,
  );
  assert.throws(
    () => validateRollbackPreflight({ ...validRow, target_release_rows: 0 }, ROLLBACK_VERSION),
    /incomplete/,
  );
  assert.throws(
    () => validateRollbackPreflight({ ...validRow, target_whole_withdrawals: 1 }, ROLLBACK_VERSION),
    /withdrawn/,
  );
});

test("rollback verification preserves both immutable releases", () => {
  const row = {
    current_release: ROLLBACK_VERSION,
    source_release_rows: 1,
    source_record_rows: 198,
    target_release_rows: 1,
    target_record_rows: 138,
  };
  assert.deepEqual(
    validateRollbackVerification(row, TARGET_VERSION, ROLLBACK_VERSION),
    {
      currentRelease: ROLLBACK_VERSION,
      retainedSourceRelease: TARGET_VERSION,
      retainedSourceRecords: 198,
      targetRecords: 138,
    },
  );
  assert.throws(
    () => validateRollbackVerification({ ...row, source_record_rows: 0 }, TARGET_VERSION, ROLLBACK_VERSION),
    /not retained/,
  );
});

test("CLI parsing defaults to dry-run and requires explicit target and execute", () => {
  const options = parseCommonD1Arguments(
    [
      "--release",
      TARGET_VERSION,
      "--database",
      "panda-atlas",
      "--config",
      "services/worker-api/wrangler.jsonc",
      "--remote",
    ],
    "activate",
  );
  assert.equal(options.execute, false);
  assert.equal(options.target, "--remote");
  assert.ok(path.isAbsolute(options.config));

  const executeOptions = parseCommonD1Arguments(
    [
      "--to",
      ROLLBACK_VERSION,
      "--database",
      "panda-atlas",
      "--remote",
      "--execute",
    ],
    "rollback",
  );
  assert.equal(executeOptions.execute, true);
  assert.equal(executeOptions.rollbackTarget, ROLLBACK_VERSION);

  assert.throws(
    () => parseCommonD1Arguments(
      ["--release", TARGET_VERSION, "--database", "panda-atlas"],
      "activate",
    ),
    /Choose --remote, --local, or --preview/,
  );
});

test("Wrangler arguments reuse the configured D1 target without shell interpolation", () => {
  const args = wranglerExecuteArguments(
    {
      database: "panda-atlas",
      config: "C:/repo/services/worker-api/wrangler.jsonc",
      target: "--remote",
      persistTo: null,
    },
    ["--command", "select 1", "--json"],
  );
  assert.deepEqual(args, [
    "d1",
    "execute",
    "panda-atlas",
    "--config",
    "C:/repo/services/worker-api/wrangler.jsonc",
    "--remote",
    "--command",
    "select 1",
    "--json",
  ]);
});
