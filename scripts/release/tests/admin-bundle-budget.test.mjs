import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  adminBundleGzipLimitBytes,
  measureAdminBundle,
  writeAdminBundleBudgetReport,
} from "../check-admin-bundle-budget.mjs";

test("isolated React-admin chunks remain within the approved gzip budget", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "panda-admin-budget-"));
  const chunk = "static/chunks/admin-shell.js";
  await mkdir(path.join(root, "static", "chunks"), { recursive: true });
  await writeFile(path.join(root, "BUILD_ID"), "test-build\n", "utf8");
  await writeFile(
    path.join(root, "react-loadable-manifest.json"),
    JSON.stringify({
      "app/admin -> @/components/admin/react-admin-shell": {
        id: 1,
        files: [chunk],
      },
    }),
    "utf8",
  );
  await writeFile(path.join(root, chunk), "export const admin = true;\n".repeat(200), "utf8");

  const report = measureAdminBundle({ nextRoot: root });
  assert.equal(report.status, "PASS");
  assert.equal(report.limit_bytes, adminBundleGzipLimitBytes);
  assert.equal(report.files.length, 1);

  const reportPath = path.join(root, "evidence", "admin-bundle-budget.json");
  const persisted = writeAdminBundleBudgetReport({
    nextRoot: root,
    reportPath,
    limitBytes: 1,
  });
  assert.equal(persisted.status, "FAIL");
});

test("admin budget fails closed when the dynamic entry is absent", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "panda-admin-budget-"));
  await writeFile(path.join(root, "BUILD_ID"), "test-build\n", "utf8");
  await writeFile(path.join(root, "react-loadable-manifest.json"), "{}\n", "utf8");

  assert.throws(
    () => measureAdminBundle({ nextRoot: root }),
    /React-admin dynamic entry was not found/,
  );
});
