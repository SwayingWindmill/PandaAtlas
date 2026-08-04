import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  scanSensitiveLogging,
} from "../check-zhipanda-log-redaction.mjs";

function fixture(files) {
  const root = mkdtempSync(path.join(os.tmpdir(), "zhipanda-log-redaction-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");
  }
  return root;
}

test("repository source does not directly log high-risk credential values", () => {
  const report = scanSensitiveLogging();

  assert.equal(
    report.outcome,
    "passed",
    report.violations.map((item) => `${item.path}:${item.line} ${item.identifier}`).join("\n"),
  );
  assert.ok(report.scanned_files > 0);
});

test("redaction check rejects direct JavaScript credential logging", () => {
  const root = fixture({
    "src/example.ts": [
      "const accessToken = getToken();",
      "console.log({ accessToken });",
      "console.info(`token=${accessToken}`);",
    ].join("\n"),
  });
  const report = scanSensitiveLogging({ root, scanRoots: ["src"] });

  assert.equal(report.outcome, "failed");
  assert.deepEqual(
    report.violations.map((item) => item.identifier),
    ["accessToken", "accessToken"],
  );
});

test("redaction check rejects direct Python credential logging", () => {
  const root = fixture({
    "src/example.py": [
      "access_token = load_token()",
      "logger.info(access_token)",
      "print(service_role_key)",
    ].join("\n"),
  });
  const report = scanSensitiveLogging({ root, scanRoots: ["src"] });

  assert.equal(report.outcome, "failed");
  assert.deepEqual(
    report.violations.map((item) => item.identifier),
    ["access_token", "service_role_key"],
  );
});

test("redaction check permits static incident messages without credential values", () => {
  const root = fixture({
    "src/example.ts": [
      "console.warn(\"authorization unavailable\");",
      "console.error(\"OTP validation failed\");",
      "logger.info(\"signed URL creation rejected\");",
    ].join("\n"),
  });
  const report = scanSensitiveLogging({ root, scanRoots: ["src"] });

  assert.equal(report.outcome, "passed");
  assert.deepEqual(report.violations, []);
});

test("redaction check excludes tests and fixtures from repository enforcement", () => {
  const root = fixture({
    "src/tests/example.test.ts": "console.log(accessToken);\n",
    "src/fixtures/example.py": "print(password)\n",
    "src/safe.ts": "console.info(\"ready\");\n",
  });
  const report = scanSensitiveLogging({ root, scanRoots: ["src"] });

  assert.equal(report.outcome, "passed");
  assert.equal(report.scanned_files, 1);
});
