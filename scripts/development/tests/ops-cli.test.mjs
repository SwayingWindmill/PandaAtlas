import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { formatPublishedPhotoKeys } from "../../release/published-photo-keys.mjs";
import {
  parseLaunchReadinessArgs,
  runLaunchReadinessCheck,
} from "../check-launch-readiness.mjs";
import {
  executeDeadLetterCommand,
  parseDeadLetterArgs,
  resolveDatabaseTarget,
} from "../ops-dead-letters.mjs";
import {
  executeModerationCommand,
  normalizeApiBaseUrl,
  parseModerationArgs,
} from "../ops-moderation.mjs";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CASE_ID = "44444444-4444-4144-8444-444444444444";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const DLQ_ID = "33333333-3333-4333-8333-333333333333";

test("ops-moderation: validates subcommands, flags, UUIDs, source evidence, and decision constraints", () => {
  assert.deepEqual(parseModerationArgs(["--help"]), { command: "help" });

  const list = parseModerationArgs(["list", "--state", "new", "--limit", "10", "--json"]);
  assert.equal(list.command, "list");
  assert.equal(list.state, "new");
  assert.equal(list.limit, 10);
  assert.equal(list.json, true);

  assert.throws(() => parseModerationArgs(["list", "--apply"]), /not supported/u);
  assert.throws(() => parseModerationArgs(["list", "--case-id", CASE_ID]), /not supported/u);
  assert.throws(() => parseModerationArgs(["list", "--offset", ""]), /integer/u);
  assert.throws(() => parseModerationArgs(["list", "--offset", "1e2"]), /integer/u);
  assert.throws(() => parseModerationArgs(["list", "--state", "bogus"]), /must be one of/u);
  assert.throws(() => parseModerationArgs(["inspect", "--case-id", "--json"]), /requires a value/u);
  assert.throws(() => parseModerationArgs(["inspect", "--case-id", "not-uuid"]), /valid UUID/u);

  // verified outcome requires both canonical-source-id and normalized-locator with DB bounds
  assert.throws(
    () =>
      parseModerationArgs([
        "verify-source",
        "--case-id",
        CASE_ID,
        "--source-id",
        SOURCE_ID,
        "--outcome",
        "verified",
        "--reason",
        "Valid reason text",
      ]),
    /canonical-source-id.*normalized-locator/u,
  );
  assert.throws(
    () =>
      parseModerationArgs([
        "verify-source",
        "--case-id",
        CASE_ID,
        "--source-id",
        SOURCE_ID,
        "--outcome",
        "verified",
        "--canonical-source-id",
        "src-1",
        "--normalized-locator",
        "ab",
        "--reason",
        "Valid reason text",
      ]),
    /3 and 2000/u,
  );
  const rejectedSource = parseModerationArgs([
    "verify-source",
    "--case-id",
    CASE_ID,
    "--source-id",
    SOURCE_ID,
    "--outcome",
    "rejected",
    "--reason",
    "Broken source link.",
  ]);
  assert.equal(rejectedSource.outcome, "rejected");

  // accepted requires assertions; duplicate requires distinct duplicate-of UUID
  assert.throws(
    () =>
      parseModerationArgs([
        "decide",
        "--case-id",
        CASE_ID,
        "--outcome",
        "accepted",
        "--explanation",
        "Verified against official base bulletin.",
      ]),
    /--assertions/u,
  );
  assert.throws(
    () =>
      parseModerationArgs([
        "decide",
        "--case-id",
        CASE_ID,
        "--outcome",
        "duplicate",
        "--explanation",
        "Duplicate of an earlier verified submission.",
      ]),
    /--duplicate-of/u,
  );
  assert.throws(
    () =>
      parseModerationArgs([
        "decide",
        "--case-id",
        CASE_ID,
        "--outcome",
        "duplicate",
        "--duplicate-of",
        CASE_ID,
        "--explanation",
        "Duplicate of an earlier verified submission.",
      ]),
    /differ from --case-id/u,
  );

  const decide = parseModerationArgs([
    "decide",
    "--case-id",
    CASE_ID,
    "--outcome",
    "duplicate",
    "--duplicate-of",
    OTHER_CASE_ID,
    "--explanation",
    "Matches earlier verified review case.",
    "--apply",
  ]);
  assert.equal(decide.duplicateOfReviewCaseId, OTHER_CASE_ID);
  assert.equal(decide.apply, true);

  // Base URL security: plaintext http disallowed except localhost/127.0.0.1
  assert.equal(normalizeApiBaseUrl(""), "https://api.zhipanda.com");
  assert.equal(normalizeApiBaseUrl("http://127.0.0.1:3001/"), "http://127.0.0.1:3001");
  assert.throws(() => normalizeApiBaseUrl("http://api.zhipanda.com"), /must use https/u);
});

test("ops-moderation: executes read/apply commands safely and ignores invalid env during --help", async () => {
  const prevBase = process.env.PANDAATLAS_API_BASE_URL;
  process.env.PANDAATLAS_API_BASE_URL = "not-a-valid-url";
  try {
    const help = await executeModerationCommand(parseModerationArgs(["--help"]));
    assert.ok(help.help.includes("ops-moderation.mjs"));
  } finally {
    if (prevBase === undefined) delete process.env.PANDAATLAS_API_BASE_URL;
    else process.env.PANDAATLAS_API_BASE_URL = prevBase;
  }

  let fetchCalled = false;
  const dryRun = await executeModerationCommand(
    parseModerationArgs(["claim", "--case-id", CASE_ID]),
    {
      apiBase: "https://api.example.test",
      token: "secret-staff-jwt",
      fetchFn: () => {
        fetchCalled = true;
        return Promise.resolve(new Response("{}"));
      },
    },
  );
  assert.equal(fetchCalled, false);
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(dryRun.url, `https://api.example.test/api/v2/review/cases/${CASE_ID}/claim`);

  const inspected = await executeModerationCommand(
    parseModerationArgs(["inspect", "--case-id", CASE_ID]),
    {
      apiBase: "https://api.example.test",
      token: "staff-token-value",
      fetchFn: (url) =>
        Promise.resolve(Response.json({ reviewCase: { reviewCaseId: CASE_ID, url } })),
    },
  );
  assert.equal(inspected.mode, "read");
  assert.equal(inspected.data.reviewCase.reviewCaseId, CASE_ID);

  const requests = [];
  const verified = await executeModerationCommand(
    parseModerationArgs([
      "verify-source",
      "--case-id",
      CASE_ID,
      "--source-id",
      SOURCE_ID,
      "--outcome",
      "verified",
      "--canonical-source-id",
      "src-canonical-1",
      "--normalized-locator",
      "https://www.panda.org.cn/cn/notice/1",
      "--reason",
      "Official institution announcement confirmed.",
      "--apply",
    ]),
    {
      apiBase: "https://api.example.test/",
      token: "Bearer staff-token-value",
      fetchFn: (url, init) => {
        requests.push({ url, init });
        return Promise.resolve(Response.json({ verified: true }, { status: 201 }));
      },
    },
  );
  assert.equal(verified.mode, "applied");
  assert.equal(requests[0].init.headers.Authorization, "Bearer staff-token-value");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    sourceId: SOURCE_ID,
    outcome: "verified",
    reason: "Official institution announcement confirmed.",
    canonicalSourceId: "src-canonical-1",
    normalizedLocator: "https://www.panda.org.cn/cn/notice/1",
  });

  await assert.rejects(
    executeModerationCommand(parseModerationArgs(["list"]), {
      apiBase: "https://api.example.test",
      token: "super-secret-jwt-123",
      fetchFn: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              status: 400,
              code: "request.validationFailed",
              detail: "Validation failed.",
              errors: [{ message: "reason too short" }],
            }),
            { status: 400, headers: { "retry-after": "60" } },
          ),
        ),
    }),
    (error) => {
      assert.match(error.message, /API 400 \[request\.validationFailed\]: Validation failed\. \[reason too short\] \(Retry-After: 60s\)/u);
      assert.ok(!error.message.includes("super-secret-jwt-123"));
      return true;
    },
  );
});

test("ops-dead-letters: enforces strict TLS, rejects ssl query downgrades, and runs transactional commands", async () => {
  assert.throws(() => parseDeadLetterArgs(["list", "--id", DLQ_ID]), /not supported/u);
  assert.throws(() => parseDeadLetterArgs(["list", "--limit", "1.5"]), /integer/u);

  assert.throws(
    () => resolveDatabaseTarget({ PANDAATLAS_OPS_DATABASE_URL: "http://db.example.com:5432/postgres", PANDAATLAS_OPS_DATABASE_SSL_CA_CERT: "ca" }),
    /postgres or postgresql/u,
  );
  assert.throws(
    () => resolveDatabaseTarget({ TEST_DATABASE_URL: "postgresql://postgres:pw@remote.example.com:5432/postgres", PANDAATLAS_OPS_DATABASE_SSL_CA_CERT: "ca" }),
    /required/u,
  );
  assert.throws(
    () => resolveDatabaseTarget({ PANDAATLAS_OPS_DATABASE_URL: "postgresql://u:p@db.example.com:5432/postgres" }),
    /SSL_CA_CERT/u,
  );
  for (const badParam of ["sslmode=no-verify", "sslmode=disable", "ssl=0", "uselibpqcompat=true"]) {
    assert.throws(
      () =>
        resolveDatabaseTarget({
          PANDAATLAS_OPS_DATABASE_URL: `postgresql://u:p@db.example.com:5432/postgres?${badParam}`,
          PANDAATLAS_OPS_DATABASE_SSL_CA_CERT: "ca",
        }),
      /not allowed/u,
    );
  }

  const remote = resolveDatabaseTarget({
    PANDAATLAS_OPS_DATABASE_URL: "postgresql://u:p@db.example.com:5432/postgres?sslmode=require&application_name=ops",
    PANDAATLAS_OPS_DATABASE_SSL_CA_CERT: "line1\\nline2",
  });
  assert.equal(remote.host, "db.example.com");
  assert.equal(remote.connectionString, "postgresql://u:p@db.example.com:5432/postgres?application_name=ops");
  assert.deepEqual(remote.ssl, { ca: "line1\nline2", rejectUnauthorized: true });

  const local = resolveDatabaseTarget({ TEST_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable" });
  assert.equal(local.host, "127.0.0.1");
  assert.equal(local.ssl, undefined);

  let missingRow = false;
  const queries = [];
  const fakeClient = {
    query: (sqlText, params) => {
      const normalized = String(sqlText).trim().toLowerCase();
      queries.push({ sql: normalized, params });
      if (normalized.includes("group by consumer_key")) {
        return Promise.resolve({ rows: [{ consumer_key: "updates", queue_name: "updates_events", count: 1 }] });
      }
      if (normalized.includes("order by dead_lettered_at")) {
        return Promise.resolve({ rows: [{ dead_letter_id: DLQ_ID, queue_name: "updates_events", msg_id: 7, read_count: 5 }] });
      }
      if (normalized.includes("from integration.dead_letters") && normalized.includes("where dead_letter_id = $1")) {
        return Promise.resolve({
          rows: missingRow
            ? []
            : [
                {
                  dead_letter_id: DLQ_ID,
                  consumer_key: "updates",
                  queue_name: "updates_events",
                  msg_id: 7,
                  event_id: CASE_ID,
                  message: { eventId: CASE_ID },
                },
              ],
        });
      }
      if (normalized.includes("from integration.outbox_events")) {
        return Promise.resolve({ rows: [{ event_id: CASE_ID, event_type: "panda.updated" }] });
      }
      if (normalized.includes("returning dead_letter_id")) {
        return Promise.resolve({
          rows: missingRow
            ? []
            : [{ dead_letter_id: DLQ_ID, consumer_key: "updates", queue_name: "updates_events", msg_id: 7, event_id: CASE_ID }],
        });
      }
      return Promise.resolve({ rows: [] });
    },
  };

  const listed = await executeDeadLetterCommand(fakeClient, parseDeadLetterArgs(["list", "--limit", "10"]));
  assert.equal(listed.summary[0].count, 1);
  assert.equal(listed.items[0].dead_letter_id, DLQ_ID);

  const inspected = await executeDeadLetterCommand(fakeClient, parseDeadLetterArgs(["inspect", "--id", DLQ_ID]));
  assert.equal(inspected.deadLetter.dead_letter_id, DLQ_ID);
  assert.equal(inspected.outboxEvent.event_type, "panda.updated");

  queries.length = 0;
  const dryReplay = await executeDeadLetterCommand(fakeClient, parseDeadLetterArgs(["replay", "--id", DLQ_ID]));
  assert.equal(dryReplay.mode, "dry-run");
  assert.equal(queries[0].sql, "begin");
  assert.equal(queries.at(-1).sql, "rollback");

  queries.length = 0;
  const appliedReplay = await executeDeadLetterCommand(fakeClient, parseDeadLetterArgs(["replay", "--id", DLQ_ID, "--apply"]));
  assert.equal(appliedReplay.mode, "applied");
  assert.equal(queries.at(-1).sql, "commit");

  queries.length = 0;
  const dryDiscard = await executeDeadLetterCommand(fakeClient, parseDeadLetterArgs(["discard", "--id", DLQ_ID]));
  assert.equal(dryDiscard.mode, "dry-run");
  assert.equal(queries.at(-1).sql, "rollback");

  queries.length = 0;
  missingRow = true;
  await assert.rejects(
    executeDeadLetterCommand(fakeClient, parseDeadLetterArgs(["discard", "--id", DLQ_ID, "--apply"])),
    /does not exist/u,
  );
  assert.equal(queries.at(-1).sql, "rollback");
});

test("check-launch-readiness: verifies local artifacts, warns consistently, and handles retries and failures", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pa-readiness-"));
  try {
    const legalPath = path.join(dir, "documents.ts");
    const photoKeysPath = path.join(dir, "published-photo-keys.json");
    const learningPath = path.join(dir, "learning.json");

    await writeFile(legalPath, 'operator: "[运营方名称]", bannerTitle: "这是草稿，尚未生效"', "utf8");
    await writeFile(photoKeysPath, formatPublishedPhotoKeys([`pandas/photos/${"a".repeat(64)}.webp`]), "utf8");
    await writeFile(learningPath, JSON.stringify({ version: "2026.11.18.1", articles: [{}], terms: [{}] }), "utf8");

    const offline = await runLaunchReadinessCheck(parseLaunchReadinessArgs(["--offline"]), {
      legalPath,
      photoKeysPath,
      learningPath,
    });
    assert.equal(offline.ok, true);
    assert.equal(offline.counts.warn, 1);
    assert.equal(offline.counts.skip, 1);

    const strictOffline = await runLaunchReadinessCheck(parseLaunchReadinessArgs(["--offline", "--strict"]), {
      legalPath,
      photoKeysPath,
      learningPath,
    });
    assert.equal(strictOffline.ok, false);

    // Clear local draft markers, verify 5xx retry succeeds on retry 2, and detect empty/lagging/draft live state
    await writeFile(legalPath, 'operator: "ZhiPanda Org"', "utf8");
    const attempts = new Map();
    const laggingOnline = await runLaunchReadinessCheck(
      { apiBase: "https://api.example.test", webBase: "https://www.example.test" },
      {
        legalPath,
        photoKeysPath,
        learningPath,
        retryDelayMs: 0,
        fetchFn: (url) => {
          const count = (attempts.get(url) ?? 0) + 1;
          attempts.set(url, count);
          if (url.endsWith("/ready") && count === 1) {
            return Promise.resolve(new Response("upstream unavailable", { status: 503 }));
          }
          if (url.endsWith("/ready") || url.endsWith("/health/async")) {
            return Promise.resolve(Response.json({ status: "ok" }));
          }
          if (url.endsWith("/api/v2/learning")) {
            return Promise.resolve(Response.json({ version: "2026.11.01.2" }));
          }
          if (url.endsWith("/api/v2/venue-news") || url.endsWith("/api/v2/overseas-status")) {
            return Promise.resolve(Response.json({ version: "2026.11.20.1", items: [] }));
          }
          if (url.endsWith("/zh/terms")) {
            return Promise.resolve(new Response("<html><body>生效日期：[生效日期]</body></html>", { status: 200 }));
          }
          return Promise.resolve(new Response("<html><body>ZhiPanda Org</body></html>", { status: 200 }));
        },
      },
    );
    assert.equal(laggingOnline.ok, true);
    assert.equal(attempts.get("https://api.example.test/ready"), 2);
    assert.deepEqual(laggingOnline.counts, { pass: 7, warn: 4, fail: 0, skip: 0 });

    // Missing learning version in live response fails cleanly instead of reporting a misleading lag/pass
    const failingOnline = await runLaunchReadinessCheck(
      { apiBase: "https://api.example.test", webBase: "https://www.example.test" },
      {
        legalPath,
        photoKeysPath,
        learningPath,
        maxRetries: 1,
        retryDelayMs: 0,
        fetchFn: (url) => {
          if (url.endsWith("/ready")) return Promise.resolve(new Response("down", { status: 503 }));
          if (url.endsWith("/api/v2/learning")) return Promise.resolve(Response.json({}));
          if (url.endsWith("/health/async")) return Promise.resolve(Response.json({ status: "ok" }));
          if (url.endsWith("/api/v2/venue-news") || url.endsWith("/api/v2/overseas-status")) {
            return Promise.resolve(Response.json({ version: "2026.11.20.1", items: [{ id: "1" }] }));
          }
          return Promise.resolve(new Response("<html><body>ZhiPanda Org</body></html>", { status: 200 }));
        },
      },
    );
    assert.equal(failingOnline.ok, false);
    assert.equal(failingOnline.counts.fail, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
