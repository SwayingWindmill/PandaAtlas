import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  appliedMigrationNamesFromWranglerJson,
  buildAtomicMigrationSql,
  listMigrationFileNames,
  pendingMigrationFileNames,
} from "../apply-d1-migrations.mjs";

test("lists D1 migrations in deterministic filename order", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "pandaatlas-migrations-"));
  try {
    writeFileSync(path.join(directory, "0007b_second.sql"), "select 2;", "utf8");
    writeFileSync(path.join(directory, "0007_first.sql"), "select 1;", "utf8");
    writeFileSync(path.join(directory, "README.md"), "ignored", "utf8");

    assert.deepEqual(listMigrationFileNames(directory), [
      "0007_first.sql",
      "0007b_second.sql",
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("builds one atomic SQL import containing the migration and history record", () => {
  const sql = buildAtomicMigrationSql(
    "0007a_guard.sql",
    "create trigger if not exists guard before update on records begin\n  select raise(abort, 'immutable');\nend;\n",
  );

  assert.match(sql, /create trigger if not exists guard/);
  assert.match(sql, /insert into d1_migrations \(name\)/);
  assert.match(sql, /select '0007a_guard\.sql'/);
  assert.match(sql, /where not exists/);
  assert.throws(
    () => buildAtomicMigrationSql("../unsafe.sql", "select 1;"),
    /Unsafe D1 migration file name/,
  );
});

test("parses applied names and selects only pending migrations", () => {
  const applied = appliedMigrationNamesFromWranglerJson(JSON.stringify([
    {
      success: true,
      results: [{ name: "0001_initial.sql" }, { name: "0002_release.sql" }],
    },
  ]));

  assert.deepEqual(
    pendingMigrationFileNames(
      ["0001_initial.sql", "0002_release.sql", "0003_guard.sql"],
      applied,
    ),
    ["0003_guard.sql"],
  );
});

test("rejects unsuccessful Wrangler JSON instead of assuming migrations applied", () => {
  assert.throws(
    () => appliedMigrationNamesFromWranglerJson(JSON.stringify([
      { success: false, results: [] },
    ])),
    /successful D1 query result/,
  );
});
