import { spawn } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const HOST = "127.0.0.1";
const PORT = "8787";
const BASE_URL = `http://${HOST}:${PORT}`;
const PERSIST_PATH = ".wrangler/smoke-state";
const ENVIRONMENT_BLOCKED_EXIT_CODE = 2;

function parseMode(argv) {
  const modeArgument = argv.find((argument) => argument.startsWith("--mode="));
  const mode = modeArgument?.slice("--mode=".length) ?? "full";
  if (!["d1", "http", "full"].includes(mode)) {
    throw new Error(`Unsupported Worker smoke mode: ${mode}`);
  }
  return mode;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with code ${code ?? "null"}${signal ? ` (${signal})` : ""}`,
        ),
      );
    });
  });
}

function runCommandCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(`${stdout}\n${stderr}`);
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with code ${code ?? "null"}${signal ? ` (${signal})` : ""}: ${stderr}`,
        ),
      );
    });
  });
}

async function waitForServer(child) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Worker exited before becoming ready with code ${child.exitCode}`,
      );
    }
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for Worker: ${String(lastError)}`);
}

async function expectJson(requestPath, expectedStatus, init) {
  const response = await fetch(`${BASE_URL}${requestPath}`, init);
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (response.status !== expectedStatus) {
    throw new Error(
      `${requestPath} returned ${response.status}, expected ${expectedStatus}: ${text}`,
    );
  }
  if (
    expectedStatus === 200 &&
    /^\/api\/v1\/(pandas|map|stats|releases)(\/|\?|$)/.test(requestPath)
  ) {
    const versions = [
      response.headers.get("X-PandaAtlas-Dataset-Version"),
      response.headers.get("X-PandaAtlas-Public-Schema-Version"),
      response.headers.get("X-PandaAtlas-Database-Migration-Version"),
    ];
    if (versions.some((value) => !value)) {
      throw new Error(
        `${requestPath} omitted active release headers: ${versions.join(",")}`,
      );
    }
  }
  return payload;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    await runCommand("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(5000),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

function wranglerBin() {
  return path.resolve(
    process.cwd(),
    "../../node_modules/wrangler/bin/wrangler.js",
  );
}

async function prepareD1Projection() {
  await rm(PERSIST_PATH, { recursive: true, force: true });
  const d1Args = [
    wranglerBin(),
    "d1",
    "execute",
    "panda-atlas",
    "--local",
    "--persist-to",
    PERSIST_PATH,
  ];
  await runCommand(process.execPath, [
    ...d1Args,
    "--file=../../infra/cloudflare/d1/schema.sql",
  ]);
  await runCommand(process.execPath, [
    ...d1Args,
    "--file=../../infra/cloudflare/d1/seed.sql",
  ]);
  await runCommand(process.execPath, [
    ...d1Args,
    "--file=../../infra/cloudflare/d1/seed.sql",
  ]);
  const releaseSql = await readFile(
    "../../data/public-releases/2026.07.14.3/d1.sql",
    "utf8",
  );
  const wranglerReleaseSql = path.join(
    PERSIST_PATH,
    "release-2026.07.14.3.sql",
  );
  await writeFile(
    wranglerReleaseSql,
    releaseSql
      .replace(/^begin immediate;\s*/i, "")
      .replace(/\s*commit;\s*$/i, ""),
    "utf8",
  );
  await runCommand(process.execPath, [
    ...d1Args,
    `--file=${wranglerReleaseSql}`,
  ]);

  const identityCheck = await runCommandCapture(process.execPath, [
    ...d1Args,
    "--command=select (select count(*) from panda_slugs where slug = 'meixiang' and slug_kind = 'legacy') as legacy_slug_count, (select count(*) from panda_names where normalized_value = 'meixiang') as searchable_name_count, (select count(*) from public_fact_conclusions where panda_id = '2939c16f-1938-5629-928c-b36b1d5cd6ed' and status in ('confirmed', 'provisional')) as conclusion_count",
  ]);
  for (const expected of [
    /"legacy_slug_count":\s*1/,
    /"searchable_name_count":\s*[1-9]\d*/,
    /"conclusion_count":\s*3/,
  ]) {
    if (!expected.test(identityCheck)) {
      throw new Error(`D1 trusted identity assertion failed: ${identityCheck}`);
    }
  }

  const archiveRelationshipCheck = await runCommandCapture(process.execPath, [
    ...d1Args,
    "--command=select (select count(*) from parentage_assertions where status = 'confirmed') as confirmed_parentage_count, (select count(*) from domain_event_participants where event_id = 'event-smithsonian-departure-2023') as departure_participant_count, (select count(*) from pandas where slug in ('bei-bei', 'xiao-qi-ji') and current_location = 'Wolong Shenshuping Base') as shenshuping_current_count",
  ]);
  if (
    !/"confirmed_parentage_count":\s*9/.test(archiveRelationshipCheck) ||
    !/"departure_participant_count":\s*3/.test(archiveRelationshipCheck) ||
    !/"shenshuping_current_count":\s*2/.test(archiveRelationshipCheck)
  ) {
    throw new Error(
      `D1 archive relationship assertion failed: ${archiveRelationshipCheck}`,
    );
  }

  let overlapRejected = false;
  try {
    await runCommandCapture(process.execPath, [
      ...d1Args,
      "--command=insert into panda_residencies (id, panda_id, facility_id, coarse_location, residency_type, start_date, start_precision, end_date, end_precision, status, publication_status) values ('overlap-canary', '2939c16f-1938-5629-928c-b36b1d5cd6ed', null, 'China', 'primary', '2023-01-01', 'day', null, null, 'confirmed', 'published')",
    ]);
  } catch (error) {
    overlapRejected = /primary residency intervals overlap/.test(String(error));
  }
  if (!overlapRejected) {
    throw new Error("D1 accepted overlapping primary residency intervals");
  }

  const sourceColumns = await runCommandCapture(process.execPath, [
    ...d1Args,
    "--command=pragma table_info(evidence_sources)",
  ]);
  if (/internal_notes|restricted_excerpt|content_hash/.test(sourceColumns)) {
    throw new Error(
      `D1 evidence_sources leaked restricted columns: ${sourceColumns}`,
    );
  }

  console.log("WORKER_SMOKE_RESULT status=passed scope=d1");
}

async function runHttpSmoke() {
  if (process.platform === "win32") {
    console.error(
      "WORKER_SMOKE_RESULT status=environment-blocked scope=http reason=Workerd HTTP smoke is supported by the Linux CI job; run the D1 mode on Windows.",
    );
    process.exitCode = ENVIRONMENT_BLOCKED_EXIT_CODE;
    return;
  }

  try {
    await access(PERSIST_PATH);
  } catch {
    throw new Error(
      "Worker HTTP smoke requires prepared D1 state; run --mode=d1 first",
    );
  }

  const worker = spawn(
    process.execPath,
    [
      wranglerBin(),
      "dev",
      "--local",
      "--host",
      HOST,
      "--port",
      PORT,
      "--persist-to",
      PERSIST_PATH,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );

  try {
    await waitForServer(worker);

    const health = await expectJson("/health", 200);
    if (health?.db !== "ok") {
      throw new Error(
        `Worker health did not report db=ok: ${JSON.stringify(health)}`,
      );
    }

    const pandas = await expectJson("/api/v1/pandas?page_size=3", 200);
    if (
      !Array.isArray(pandas?.items) ||
      pandas.items.length === 0 ||
      pandas?.meta?.total !== 7
    ) {
      throw new Error("Worker panda list smoke response was empty");
    }

    const identitySearch = await expectJson(
      "/api/v1/pandas?q=M%C4%9Bixi%C4%81ng&page_size=100",
      200,
    );
    const meiXiangSearchResult = identitySearch?.items?.find(
      (item) => item.id === "2939c16f-1938-5629-928c-b36b1d5cd6ed",
    );
    if (
      !meiXiangSearchResult ||
      !Array.isArray(meiXiangSearchResult.search_terms) ||
      !meiXiangSearchResult.search_terms.includes("Měixiāng") ||
      !meiXiangSearchResult.search_terms.includes("meixiang") ||
      !meiXiangSearchResult.search_terms.includes(
        "smithsonian_history_key:mei-xiang",
      )
    ) {
      throw new Error(
        `Worker identity search missed Mei Xiang: ${JSON.stringify(identitySearch)}`,
      );
    }

    const trustedDetail = await expectJson("/api/v1/pandas/meixiang", 200);
    if (
      trustedDetail?.slug !== "mei-xiang" ||
      trustedDetail?.identity?.stable_id !==
        "2939c16f-1938-5629-928c-b36b1d5cd6ed" ||
      trustedDetail?.conclusions?.length !== 3 ||
      trustedDetail?.sources?.length < 2 ||
      trustedDetail?.current_place?.coarse_location !== "China" ||
      trustedDetail?.residencies?.length !== 2 ||
      trustedDetail?.events?.length !== 2 ||
      trustedDetail?.record_tier !== "complete_first_pass" ||
      trustedDetail?.localized_content?.length !== 2 ||
      trustedDetail?.media_release?.display_mode !== "designed_empty_state" ||
      trustedDetail?.public_revision?.data_version !== "2026.07.14.3" ||
      trustedDetail.events.find(
        (event) => event.id === "event-smithsonian-return-plan-2020",
      )?.changes_current_residency !== false ||
      trustedDetail.events.find(
        (event) => event.id === "event-smithsonian-departure-2023",
      )?.participants?.length !== 3
    ) {
      throw new Error(
        `Worker trusted detail was incomplete: ${JSON.stringify(trustedDetail)}`,
      );
    }
    const trustedSerialized = JSON.stringify(trustedDetail);
    if (
      /internal_notes|restricted_excerpt|content_hash|curator_notes/.test(
        trustedSerialized,
      )
    ) {
      throw new Error(
        `Worker trusted detail leaked restricted evidence: ${trustedSerialized}`,
      );
    }

    const trustedLineage = await expectJson(
      "/api/v1/pandas/mei-xiang/lineage",
      200,
    );
    if (
      !trustedLineage?.edges?.some(
        (edge) =>
          edge.parent_id === "2939c16f-1938-5629-928c-b36b1d5cd6ed" &&
          edge.child_id === "96d00a39-7865-55db-b5c2-f339ef692258",
      ) ||
      !Array.isArray(trustedLineage?.relationships)
    ) {
      throw new Error(
        `Worker trusted lineage was not assertion-derived: ${JSON.stringify(trustedLineage)}`,
      );
    }

    const distribution = await expectJson(
      "/api/v1/map/distribution?bbox=100,25,110,36&layer=wild&zoom=4",
      200,
    );
    if (
      distribution?.meta?.limit !== 1500 ||
      distribution.meta.requested_zoom !== 4
    ) {
      throw new Error(
        `Unexpected distribution metadata: ${JSON.stringify(distribution?.meta)}`,
      );
    }

    const stats = await expectJson("/api/v1/stats/overview", 200);
    if (stats?.total_pandas !== pandas.meta.total) {
      throw new Error(
        `Worker stats escaped active release: ${JSON.stringify(stats)}`,
      );
    }

    await expectJson("/api/v1/admin/import-sources", 404);
    await expectJson("/api/v1/admin/import-jobs", 404, {
      method: "POST",
      headers: {
        Authorization: "Bearer ignored-on-read-projection",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source_name: "must-not-execute.sql" }),
    });

    console.log("WORKER_SMOKE_RESULT status=passed scope=http");
  } finally {
    await stopProcess(worker);
  }
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  if (mode === "d1" || mode === "full") {
    await prepareD1Projection();
  }
  if (mode === "http" || mode === "full") {
    await runHttpSmoke();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
