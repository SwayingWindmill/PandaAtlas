import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  loadOperationalReadinessContract,
  repositoryRoot,
  validateOperationalReadinessContract,
} from "./check-zhipanda-v1-operational-readiness.mjs";
import {
  loadRecoveryRehearsalContract,
  validateRecoveryRehearsalContract,
} from "./check-zhipanda-v1-recovery-rehearsal.mjs";

export const defaultEvidencePath = path.join(
  repositoryRoot,
  ".release-gate",
  "zhipanda-v1-operational-readiness.json",
);

const EVIDENCE_INPUTS = [
  "contracts/zhipanda-v1-operational-readiness.v1.json",
  "contracts/zhipanda-v1-recovery-rehearsal.v1.json",
  "docs/runbooks/zhipanda-v1-operational-readiness.md",
  "scripts/release/check-zhipanda-v1-recovery-rehearsal.mjs",
  "scripts/release/run-zhipanda-v1-recovery-rehearsal.mjs",
  "scripts/release/default.mjs",
  "scripts/release/extended.mjs",
  "scripts/release/map-close.mjs",
  "scripts/release/windows-map-close.mjs",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function generatedAtFromEnvironment() {
  if (process.env.SOURCE_DATE_EPOCH) {
    const seconds = Number(process.env.SOURCE_DATE_EPOCH);
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error("SOURCE_DATE_EPOCH must be a non-negative number of seconds.");
    }
    return new Date(seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

export function buildOperationalReadinessEvidence({
  root = repositoryRoot,
  generatedAt = generatedAtFromEnvironment(),
  sourceCommit = process.env.GITHUB_SHA ?? null,
} = {}) {
  const contractPath = path.join(
    root,
    "contracts",
    "zhipanda-v1-operational-readiness.v1.json",
  );
  const rehearsalContractPath = path.join(
    root,
    "contracts",
    "zhipanda-v1-recovery-rehearsal.v1.json",
  );
  const contract = loadOperationalReadinessContract(contractPath);
  const summary = validateOperationalReadinessContract(contract, { root });
  const rehearsalContract = loadRecoveryRehearsalContract(rehearsalContractPath);
  const recoveryRehearsal = validateRecoveryRehearsalContract(
    rehearsalContract,
    { root },
  );

  const inputs = EVIDENCE_INPUTS.map((relativePath) => {
    const bytes = readFileSync(path.join(root, relativePath));
    return {
      path: relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  });
  const plannedDrills = contract.recovery_drills
    .filter((drill) => drill.status === "planned")
    .map((drill) => ({
      id: drill.id,
      blocked_by_issue: drill.blocked_by_issue,
    }));

  const immutablePayload = {
    schema_version: 1,
    contract_id: contract.contract_id,
    contract_status: contract.status,
    summary,
    recovery_rehearsal: recoveryRehearsal,
    inputs,
    planned_drills: plannedDrills,
  };
  const evidenceDigest = sha256(canonicalJson(immutablePayload));

  return {
    ...immutablePayload,
    evidence_id: `sha256:${evidenceDigest}`,
    generated_at: generatedAt,
    source_commit: sourceCommit,
    outcome: plannedDrills.length === 0 ? "passed" : "in-progress",
  };
}

export function writeOperationalReadinessEvidence(
  outputPath = defaultEvidencePath,
  options = {},
) {
  const evidence = buildOperationalReadinessEvidence(options);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return evidence;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const outputPath = process.argv[2]
      ? path.resolve(repositoryRoot, process.argv[2])
      : defaultEvidencePath;
    const evidence = writeOperationalReadinessEvidence(outputPath);
    process.stdout.write(
      `${JSON.stringify({
        output: path.relative(repositoryRoot, outputPath),
        outcome: evidence.outcome,
        evidence_id: evidence.evidence_id,
        inputs: evidence.inputs.length,
        recovery_rehearsal: evidence.recovery_rehearsal.status,
        planned_drills: evidence.planned_drills.length,
      }, null, 2)}\n`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
