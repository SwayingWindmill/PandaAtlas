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
  parseModerationArgs,
} from "../ops-moderation.mjs";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const DLQ_ID = "33333333-3333-4333-8333-333333333333";

test("ops-moderation: validates subcommands, UUIDs, and decision constraints", () => {
  assert.deepEqual(parseModerationArgs(["--help"]), { command: "help" });

  const list = parseModerationArgs(["list", "--state", "new", "--limit", "10", "--json"]);
  assert.equal(list.command, "list");
  assert.equal(list.state, "new");
  assert.equal(list.limit, 10);
  assert.equal(list.json, true);

  assert.throws(() => parseModerationArgs(["list", "--apply"]), /not supported/u);
  assert.throws(() => parseModerationArgs(["list", "--state", "bogus"]), /must be one of/u);
  assert.throws(() => parseModerationArgs(["inspect", "--case-id", "not-uuid"]), /valid UUID/u);
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
        "no",
      ]),
    /3 and 2000/u,
  );
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

  const decide = parseModerationArgs([
    "decide",
    "--case-id",
    CASE_ID,
    "--outcome",
    "accepted",
    "--assertions",
    "a1, a2, a1",
    "--explanation",
    "Verified against official base bulletin.",
    "--apply",
  ]);
  assert.deepEqual(decide.selectedAssertionKeys, ["a1", "a2"]);
  assert.equal(decide.apply, true);
});

test("ops-moderation: mutating commands default to dry-run and redact bearer tokens on HTTP errors", async () => {
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

  const requests = [];
  const applied = await executeModerationCommand(
    parseModerationArgs([
      "decide",
      "--case-id",
      CASE_ID,
      "--outcome",
      "not_accepted",
      "--explanation",
      "Source contradicts official record.",
      "--apply",
    ]),
    {
      apiBase: "https://api.example.test/",
      token: "Bearer staff-token-value",
      fetchFn: (url, init) => {
        requests.push({ url, init });
        return Promise.resolve(new Response(JSON.stringify({ decided: true }), { status: 200 }));
      },
    },
  );
  assert.equal(applied.mode, "applied");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.headers.Authorization, "Bearer staff-token-value");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    outcome: "not_accepted",
    selectedAssertionKeys: [],
    userVisibleExplanation: "Source contradicts official record.",
  });

  await assert.rejects(
    executeModerationCommand(parseModerationArgs(["list"]), {
      apiBase: "https://api.example.test",
      token: "super-secret-jwt-123",
      fetchFn: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({ status: 429, code: "request.rateLimited", detail: "Slow down." }),
            { status: 429, headers: { "retry-after": "60" } },
          ),
        ),
    }),
    (error) => {
      assert.match(error.message, /API 429 \[request\.rateLimited\]: Slow down\. \(Retry-After: 60s\)/u);
      assert.ok(!error.message.includes("super-secret-jwt-123"));
      return true;
    },
  );
});

test("ops-dead-letters: enforces TLS CA on remote hosts and uses transaction rollback on dry-run", async () => {
  assert.throws(
    () => resolveDatabaseTarget({ PANDAATLAS_OPS_DATABASE_URL: "postgresql://u:p@db.example.com:5432/postgres" }),
    /SSL_CA_CERT/u,
  );
  const remote = resolveDatabaseTarget({
    PANDAATLAS_OPS_DATABASE_URL: "postgresql://u:p@db.example.com:5432/postgres",
    PANDAATLAS_OPS_DATABASE_SSL_CA_CERT: "line1\\nline2",
  });
  assert.equal(remote.host, "db.example.com");
  assert.deepEqual(remote.ssl, { ca: "line1\nline2", rejectUnauthorized: true });

  const local = resolveDatabaseTarget({ TEST_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
  assert.equal(local.host, "127.0.0.1");
  assert.equal(local.ssl, undefined);

  const queries = [];
  const fakeClient = {
    query: (sqlText, params) => {
      queries.push({ sql: String(sqlText).trim().toLowerCase(), params });
      if (String(sqlText).includes("for update")) {
        return Promise.resolve({
          rows: [
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
      if (String(sqlText).includes("returning dead_letter_id")) {
        return Promise.resolve({
          rows: [
            {
              dead_letter_id: DLQ_ID,
              consumer_key: "updates",
              queue_name: "updates_events",
              msg_id: 7,
              event_id: CASE_ID,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    },
  };

  const dryReplay = await executeDeadLetterCommand(fakeClient, parseDeadLetterArgs(["replay", "--id", DLQ_ID]));
  assert.equal(dryReplay.mode, "dry-run");
  assert.equal(queries.at(-1).sql, "rollback");

  queries.length = 0;
  const appliedDiscard = await executeDeadLetterCommand(
    fakeClient,
    parseDeadLetterArgs(["discard", "--id", DLQ_ID, "--apply"]),
  );
  assert.equal(appliedDiscard.mode, "applied");
  assert.equal(queries[0].sql, "begin");
  assert.equal(queries.at(-1).sql, "commit");
});

test("check-launch-readiness: verifies local artifacts, warns on drafts/version lag, and enforces --strict", async () => {
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

    // Clear legal draft markers and mock healthy live endpoints matching local state.
    await writeFile(legalPath, 'operator: "ZhiPanda Org"', "utf8");
    const attempts = new Map();
    const healthyOnline = await runLaunchReadinessCheck(
      { apiBase: "https://api.example.test", webBase: "https://www.example.test" },
      {
        legalPath,
        photoKeysPath,
        learningPath,
        retryDelayMs: 0,
        fetchFn: (url) => {
          const count = (attempts.get(url) ?? 0) + 1;
          attempts.set(url, count);
          if (url.endsWith("/zh") && count === 1) {
            return Promise.reject(new TypeError("fetch failed"));
          }
          if (url.endsWith("/ready") || url.endsWith("/health/async")) {
            return Promise.resolve(Response.json({ status: "ok" }));
          }
          if (url.endsWith("/api/v2/learning")) {
            return Promise.resolve(Response.json({ version: "2026.11.18.1" }));
          }
          if (url.endsWith("/api/v2/venue-news") || url.endsWith("/api/v2/overseas-status")) {
            return Promise.resolve(Response.json({ version: "2026.11.20.1", items: [{ id: "1" }] }));
          }
          return Promise.resolve(new Response("<html><body>ZhiPanda Org</body></html>", { status: 200 }));
        },
      },
    );
    assert.equal(healthyOnline.ok, true);
    assert.equal(attempts.get("https://www.example.test/zh"), 2);
    assert.deepEqual(healthyOnline.counts, { pass: 11, warn: 0, fail: 0, skip: 0 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
