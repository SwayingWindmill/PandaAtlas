import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const preflightPath = path.join(repoRoot, "scripts", "release", "check-beta-hard-gates.mjs");

async function withTempDirectory(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "panda-beta-preflight-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

function runPreflight(...args) {
  return spawnSync(process.execPath, [preflightPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

async function copyFixture(directory) {
  for (const relative of [
    "contracts/beta-hard-gates.v1.json",
    "contracts/golden-dataset/mei-xiang-family.v1.json",
    "data/beta-launch/waivers.json",
  ]) {
    const target = path.join(directory, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(repoRoot, relative), target);
  }
  await cp(
    path.join(repoRoot, "data/public-releases/2026.07.18.1"),
    path.join(directory, "data/public-releases/2026.07.18.1"),
    { recursive: true },
  );
}

async function runFixture(directory) {
  const reportPath = path.join(directory, "report.json");
  const result = runPreflight("--root", directory, "--report", reportPath);
  return { result, report: JSON.parse(await readFile(reportPath, "utf8")) };
}

function assertFailedCheck(run, id, detailPattern) {
  assert.equal(run.result.status, 1, run.result.stderr || run.result.stdout);
  assert.equal(run.report.outcome, "failed");
  const check = run.report.checks.find((item) => item.id === id);
  assert.equal(check?.status, "failed");
  assert.match(check?.detail ?? "", detailPattern);
}

async function updateManifestFile(directory, filename) {
  const releaseDir = path.join(directory, "data/public-releases/2026.07.18.1");
  const content = await readFile(path.join(releaseDir, filename));
  const manifestPath = path.join(releaseDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files[filename] = {
    bytes: content.byteLength,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

test("clean repository satisfies the Beta hard-gate preflight and writes evidence", async () => {
  await withTempDirectory(async (directory) => {
    const reportPath = path.join(directory, "beta-hard-gates.json");
    const result = runPreflight("--root", repoRoot, "--report", reportPath);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.outcome, "passed");
    assert.equal(report.dataset_release_version, "2026.07.18.1");
    assert.deepEqual(
      report.checks.map((check) => check.id),
      ["release-integrity", "public-data-boundary", "trusted-archive", "admin-token-boundary", "waiver-policy"],
    );
    assert.ok(report.checks.every((check) => check.status === "passed"));
  });
});

test("manifest corruption fails release integrity", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const apiPath = path.join(directory, "data/public-releases/2026.07.18.1/api.json");
    await writeFile(apiPath, `${await readFile(apiPath, "utf8")} `, "utf8");

    assertFailedCheck(await runFixture(directory), "release-integrity", /byte count|SHA-256/);
  });
});

test("missing manifest descriptors fail release integrity", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const manifestPath = path.join(directory, "data/public-releases/2026.07.18.1/manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    delete manifest.files["d1.sql"];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    assertFailedCheck(await runFixture(directory), "release-integrity", /manifest file set drifted/);
  });
});

test("expanded releases require a tracked base release manifest", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const datasetPath = path.join(directory, "data/reviewed-batches/2026.07.20.1/source.json");
    await mkdir(path.dirname(datasetPath), { recursive: true });
    await cp(path.join(repoRoot, "data/reviewed-batches/2026.07.20.1/source.json"), datasetPath);
    await cp(
      path.join(repoRoot, "data/public-releases/2026.07.20.1"),
      path.join(directory, "data/public-releases/2026.07.20.1"),
      { recursive: true },
    );
    const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
    dataset.dataset.base_dataset_version = "2026.07.19.99";
    await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
    const reportPath = path.join(directory, "report.json");
    const result = runPreflight(
      "--root",
      directory,
      "--report",
      reportPath,
      "--dataset",
      datasetPath,
    );
    const report = JSON.parse(await readFile(reportPath, "utf8"));

    assert.equal(result.status, 1, result.stderr || result.stdout);
    const check = report.checks.find((item) => item.id === "release-integrity");
    assert.equal(check?.status, "failed");
    assert.match(check?.detail ?? "", /2026\.07\.19\.99/);
  });
});

test("private fields fail the public data boundary even with a valid manifest", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const apiPath = path.join(directory, "data/public-releases/2026.07.18.1/api.json");
    const api = JSON.parse(await readFile(apiPath, "utf8"));
    api.pandas[0].contact_email = "curator@example.org";
    await writeFile(apiPath, `${JSON.stringify(api, null, 2)}\n`, "utf8");
    await updateManifestFile(directory, "api.json");

    assertFailedCheck(await runFixture(directory), "public-data-boundary", /contact_email/);
  });
});

test("personal location fields fail the public data boundary", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const apiPath = path.join(directory, "data/public-releases/2026.07.18.1/api.json");
    const api = JSON.parse(await readFile(apiPath, "utf8"));
    api.pandas[0].home_address = "Private residence";
    await writeFile(apiPath, `${JSON.stringify(api, null, 2)}\n`, "utf8");
    await updateManifestFile(directory, "api.json");

    assertFailedCheck(await runFixture(directory), "public-data-boundary", /home_address/);
  });
});

test("unknown correction-personal fields fail the public allowlist", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const apiPath = path.join(directory, "data/public-releases/2026.07.18.1/api.json");
    const api = JSON.parse(await readFile(apiPath, "utf8"));
    api.pandas[0].submitter_name = "Jane Doe";
    api.pandas[0].correction_text = "Please update this profile.";
    await writeFile(apiPath, `${JSON.stringify(api, null, 2)}\n`, "utf8");
    await updateManifestFile(directory, "api.json");

    assertFailedCheck(await runFixture(directory), "public-data-boundary", /submitter_name.*allowlist/);
  });
});

test("each CSV row must carry the exact release version", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const csvPath = path.join(directory, "data/public-releases/2026.07.18.1/pandas.csv");
    const lines = (await readFile(csvPath, "utf8")).split(/\r?\n/);
    lines[1] = lines[1].replace(/^2026\.07\.18\.1/, "2025.01.01.1");
    await writeFile(csvPath, lines.join("\n"), "utf8");
    await updateManifestFile(directory, "pandas.csv");

    assertFailedCheck(await runFixture(directory), "release-integrity", /pandas\.csv row 2 dataset release drifted/);
  });
});

test("D1 release registry must carry the exact release version", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const d1Path = path.join(directory, "data/public-releases/2026.07.18.1/d1.sql");
    const d1 = await readFile(d1Path, "utf8");
    await writeFile(d1Path, d1.replace("'2026.07.18.1', '1.1.0', '0007'", "'2025.01.01.1', '1.1.0', '0007'"), "utf8");
    await updateManifestFile(directory, "d1.sql");

    assertFailedCheck(
      await runFixture(directory),
      "release-integrity",
      /d1\.sql release registry dataset_release_version drifted/,
    );
  });
});

test("non-canonical D1 record inserts cannot bypass structured validation", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const d1Path = path.join(directory, "data/public-releases/2026.07.18.1/d1.sql");
    const d1 = await readFile(d1Path, "utf8");
    const unsafe = d1.replace(
      "insert into public_release_records (dataset_release_version, entity_type, entity_id, public_json) values ('2026.07.18.1', 'events'",
      "insert\ninto public_release_records (dataset_release_version, entity_type, entity_id, public_json) values ('2025.01.01.1', 'events'",
    );
    assert.notEqual(unsafe, d1);
    await writeFile(d1Path, unsafe, "utf8");
    await updateManifestFile(directory, "d1.sql");

    assertFailedCheck(await runFixture(directory), "release-integrity", /non-canonical public release record insert/);
  });
});

test("precise D1 wild geometry fails the public data boundary", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const d1Path = path.join(directory, "data/public-releases/2026.07.18.1/d1.sql");
    const d1 = await readFile(d1Path, "utf8");
    const unsafe = d1.replace(
      "[[[[103.5,31.2],[103.9,31.2],[103.9,31.6],[103.5,31.6],[103.5,31.2]]]]",
      "[[[[103.5,31.2],[103.501,31.2],[103.501,31.201],[103.5,31.201],[103.5,31.2]]]]",
    );
    assert.notEqual(unsafe, d1);
    await writeFile(d1Path, unsafe, "utf8");
    await updateManifestFile(directory, "d1.sql");

    assertFailedCheck(await runFixture(directory), "public-data-boundary", /too precise for publication/);
  });
});

test("unreviewed lineage sources fail the trusted archive gate", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const datasetPath = path.join(directory, "contracts/golden-dataset/mei-xiang-family.v1.json");
    const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
    const sourceId = dataset.parentage_assertions[0].public.source_ids[0];
    dataset.sources.find((source) => source.id === sourceId).public.access_state = "unavailable";
    await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

    assertFailedCheck(await runFixture(directory), "trusted-archive", /not reviewed and accessible/);
  });
});

test("unverified confirmed facts fail the trusted archive gate", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const datasetPath = path.join(directory, "contracts/golden-dataset/mei-xiang-family.v1.json");
    const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
    dataset.facts[0].public.last_verified_at = null;
    await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

    assertFailedCheck(await runFixture(directory), "trusted-archive", /confirmed fact is unverified/);
  });
});

test("missing current residency fails the trusted archive gate", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const datasetPath = path.join(directory, "contracts/golden-dataset/mei-xiang-family.v1.json");
    const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
    const pandaId = dataset.pandas[0].id;
    const residency = dataset.residencies.find(
      (item) =>
        item.public.panda_id === pandaId && item.public.residency_type === "primary" && item.public.end_date == null,
    );
    residency.public.end_date = "2026-07-14";
    await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

    assertFailedCheck(await runFixture(directory), "trusted-archive", /exactly one current primary residency/);
  });
});

test("hard gates cannot be waived", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const waiverPath = path.join(directory, "data/beta-launch/waivers.json");
    await writeFile(
      waiverPath,
      `${JSON.stringify(
        {
          policy_version: "1",
          waivers: [
            {
              gate_id: "no-sensitive-public-data",
              user_impact: "Private data could ship.",
              mitigation: "None.",
              owner: "release-manager",
              deadline: "2026-07-16",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    assertFailedCheck(await runFixture(directory), "waiver-policy", /cannot be waived/);
  });
});

test("admin token markers fail when they reach client source", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const clientPath = path.join(directory, "apps/web/components/leak.tsx");
    await mkdir(path.dirname(clientPath), { recursive: true });
    await writeFile(
      clientPath,
      '// Client boundary declaration follows this comment.\n"use client";\nexport const leaked = "ADMIN_API_TOKEN";\n',
      "utf8",
    );

    assertFailedCheck(await runFixture(directory), "admin-token-boundary", /ADMIN_API_TOKEN/);
  });
});

test("admin token markers fail in server components that can render browser payloads", async () => {
  await withTempDirectory(async (directory) => {
    await copyFixture(directory);
    const serverComponentPath = path.join(directory, "apps/web/app/leak/page.tsx");
    await mkdir(path.dirname(serverComponentPath), { recursive: true });
    await writeFile(
      serverComponentPath,
      "export default function Leak() { return <p>{process.env.ADMIN_API_TOKEN}</p>; }\n",
      "utf8",
    );

    assertFailedCheck(await runFixture(directory), "admin-token-boundary", /ADMIN_API_TOKEN/);
  });
});
