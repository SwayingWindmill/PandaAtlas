from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if content.count(old) != 1:
        raise RuntimeError(f"Expected one match in {path}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))


package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["scripts"]["drill:moderation-recovery"] = (
    "uv run --directory services/api --frozen --extra dev python "
    "scripts/run_moderation_recovery_drill.py"
)
package["scripts"]["drill:privacy-tombstone-recovery"] = (
    "uv run --directory services/api --frozen --extra dev python "
    "scripts/run_privacy_tombstone_recovery_drill.py"
)
package["scripts"]["drill:audit-integrity-recovery"] = (
    "uv run --directory services/api --frozen --extra dev python "
    "scripts/run_audit_integrity_recovery_drill.py"
)
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

workflow = ".github/workflows/approved-release-bootstrap.yml"
replace_once(
    workflow,
    '      - "services/api/scripts/run_privacy_tombstone_recovery_drill.py"\n',
    '      - "services/api/scripts/run_moderation_recovery_drill.py"\n'
    '      - "services/api/scripts/run_privacy_tombstone_recovery_drill.py"\n',
)
replace_once(
    workflow,
    '      - "services/api/tests/integration/test_privacy_operations_real_db.py"\n',
    '      - "services/api/tests/integration/test_scoped_moderation_real_db.py"\n'
    '      - "services/api/tests/integration/test_privacy_operations_real_db.py"\n',
)
replace_once(
    workflow,
    '      - name: Run privacy tombstone recovery drill\n',
    '      - name: Run moderation recovery drill\n'
    '        working-directory: services/api\n'
    '        run: >-\n'
    '          uv run --isolated --frozen --extra dev python\n'
    '          scripts/run_moderation_recovery_drill.py\n\n'
    '      - name: Run privacy tombstone recovery drill\n',
)
replace_once(
    workflow,
    '            .release-gate/privacy-tombstone-recovery.json\n',
    '            .release-gate/moderation-recovery.json\n'
    '            .release-gate/privacy-tombstone-recovery.json\n',
)

contract_path = ROOT / "contracts/zhipanda-v1-operational-readiness.v1.json"
contract = json.loads(contract_path.read_text(encoding="utf-8"))
feature_drills = {
    "moderation-stop-drain": {
        "command": "npm run drill:moderation-recovery",
        "evidence": "services/api/scripts/run_moderation_recovery_drill.py",
        "proves": (
            "Fail-closed command stop, appeal drain to append-only decision, "
            "sanction restoration, scoped enforcement, and transactional projections."
        ),
    },
    "privacy-tombstone-replay": {
        "command": "npm run drill:privacy-tombstone-recovery",
        "evidence": "services/api/scripts/run_privacy_tombstone_recovery_drill.py",
        "proves": (
            "Deletion tombstone reapplication after restore, narrow Holds, "
            "non-held deletion continuation, and duplicate replay idempotency."
        ),
    },
    "audit-integrity-recovery": {
        "command": "npm run drill:audit-integrity-recovery",
        "evidence": "services/api/scripts/run_audit_integrity_recovery_drill.py",
        "proves": (
            "Integrity mismatch detection, append-only mutation denial, encrypted "
            "export expiry, and idempotent retention recovery."
        ),
    },
}
for drill in contract["recovery_drills"]:
    if drill["id"] in feature_drills:
        drill["status"] = "available"
        drill.pop("blocked_by_issue", None)
        drill.update(feature_drills[drill["id"]])
contract_path.write_text(json.dumps(contract, indent=2) + "\n", encoding="utf-8")

validator = "scripts/release/check-zhipanda-v1-operational-readiness.mjs"
replace_once(
    validator,
    '''const REQUIRED_AVAILABLE_DRILLS = new Set([
  "immutable-release-recovery",
  "postgres-attachment-recovery",
  "identity-engagement-recovery",
  "notification-staging",
  "api-withdrawal-rollback",
  "web-withdrawal-rollback",
  "supabase-clean-reset",
]);

const REQUIRED_PLANNED_DRILLS = new Map([
  ["moderation-stop-drain", 197],
  ["privacy-tombstone-replay", 198],
  ["audit-integrity-recovery", 199],
]);
''',
    '''const REQUIRED_AVAILABLE_DRILLS = new Set([
  "immutable-release-recovery",
  "postgres-attachment-recovery",
  "identity-engagement-recovery",
  "notification-staging",
  "api-withdrawal-rollback",
  "web-withdrawal-rollback",
  "supabase-clean-reset",
  "moderation-stop-drain",
  "privacy-tombstone-replay",
  "audit-integrity-recovery",
]);

const REQUIRED_PLANNED_DRILLS = new Map();
''',
)

write(
    "scripts/release/tests/zhipanda-v1-operational-readiness.test.mjs",
    '''import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  loadOperationalReadinessContract,
  repositoryRoot,
  validateOperationalReadinessContract,
} from "../check-zhipanda-v1-operational-readiness.mjs";

function cloneContract() {
  return structuredClone(loadOperationalReadinessContract());
}

test("V1 operational readiness is integrated into the existing Release Gate", () => {
  const summary = validateOperationalReadinessContract(cloneContract());

  assert.deepEqual(summary, {
    contract_id: "zhipanda-v1-operational-readiness",
    status: "in-progress",
    slos: 14,
    p1_slos: 9,
    available_drills: 10,
    planned_drills: 0,
    runbook_sections: 11,
    release_gate_integrated: true,
  });
});

test("operational runbook contains every contract section", () => {
  const contract = cloneContract();
  const runbook = readFileSync(
    path.join(repositoryRoot, "docs/runbooks/zhipanda-v1-operational-readiness.md"),
    "utf8",
  );

  for (const section of contract.required_runbook_sections) {
    assert.match(runbook, new RegExp(`^## ${section}$`, "m"));
  }
  assert.match(runbook, /does not authorize an independent release path/);
  assert.match(runbook, /No feature-specific recovery drill remains `planned`/);
});

test("operational readiness rejects a missing product SLO", () => {
  const contract = cloneContract();
  contract.service_level_objectives = contract.service_level_objectives.filter(
    (slo) => slo.id !== "privacy_deletion",
  );

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /Missing required SLO privacy_deletion/,
  );
});

test("safety-critical SLO alerts cannot be downgraded", () => {
  const contract = cloneContract();
  const audit = contract.service_level_objectives.find((slo) => slo.id === "audit");
  audit.alert.severity = "P2";

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /SLO audit is safety-critical and must alert at P1/,
  );
});

test("operational readiness forbids a parallel certification system", () => {
  const contract = cloneContract();
  contract.release_system.rule = "Create an independent certification path.";

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /must forbid an independent certification path/,
  );
});

test("feature drills cannot regress to planned after their slices land", () => {
  const contract = cloneContract();
  const replay = contract.recovery_drills.find(
    (drill) => drill.id === "privacy-tombstone-replay",
  );
  replay.status = "planned";
  replay.command = null;
  replay.blocked_by_issue = 198;
  delete replay.evidence;

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /is not a recognized planned drill/,
  );
});

test("available feature drills require executable commands", () => {
  const contract = cloneContract();
  const drill = contract.recovery_drills.find(
    (item) => item.id === "moderation-stop-drain",
  );
  drill.command = null;

  assert.throws(
    () => validateOperationalReadinessContract(contract, { checkEvidence: false }),
    /must use an npm run command/,
  );
});

test("available recovery drills require repository evidence", () => {
  const contract = cloneContract();
  const drill = contract.recovery_drills.find(
    (item) => item.id === "audit-integrity-recovery",
  );
  drill.evidence = "missing/recovery-evidence.md";

  assert.throws(
    () => validateOperationalReadinessContract(contract),
    /references missing path missing\\/recovery-evidence\\.md/,
  );
});
''',
)

writer = "scripts/release/write-zhipanda-v1-operational-readiness-evidence.mjs"
replace_once(
    writer,
    '''function evidenceInputPaths(controlMatrix) {
  const controlPaths = controlMatrix.controls.flatMap((control) =>
    control.evidence.map((item) => item.path),
  );
  return [...new Set([...BASE_EVIDENCE_INPUTS, ...controlPaths])].sort();
}
''',
    '''function evidenceInputPaths(contract, controlMatrix) {
  const controlPaths = controlMatrix.controls.flatMap((control) =>
    control.evidence.map((item) => item.path),
  );
  const drillPaths = contract.recovery_drills
    .filter((drill) => drill.status === "available")
    .map((drill) => drill.evidence);
  return [...new Set([...BASE_EVIDENCE_INPUTS, ...controlPaths, ...drillPaths])].sort();
}
''',
)
replace_once(
    writer,
    "  const inputs = evidenceInputPaths(controlMatrix).map((relativePath) => {\n",
    "  const inputs = evidenceInputPaths(contract, controlMatrix).map((relativePath) => {\n",
)

write(
    "scripts/release/tests/zhipanda-v1-operational-evidence.test.mjs",
    '''import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildOperationalReadinessEvidence,
  writeOperationalReadinessEvidence,
} from "../write-zhipanda-v1-operational-readiness-evidence.mjs";

test("operational readiness evidence seals controls, contracts, runbooks, rehearsal, gates, and real drills", () => {
  const evidence = buildOperationalReadinessEvidence({
    generatedAt: "2026-08-04T00:00:00.000Z",
    sourceCommit: "candidate-commit",
  });

  assert.equal(evidence.schema_version, 1);
  assert.equal(evidence.contract_id, "zhipanda-v1-operational-readiness");
  assert.equal(evidence.contract_status, "in-progress");
  assert.equal(evidence.outcome, "in-progress");
  assert.match(evidence.evidence_id, /^sha256:[0-9a-f]{64}$/);
  assert.ok(evidence.inputs.length > 26);
  assert.deepEqual(evidence.operational_controls, {
    matrix_id: "zhipanda-v1-operational-controls",
    status: "in-progress",
    controls: 15,
    available_controls: 11,
    final_candidate_controls: 4,
    evidence_files: 23,
    release_gate_integrated: true,
  });
  assert.deepEqual(evidence.recovery_rehearsal, {
    rehearsal_id: "zhipanda-v1-cross-feature-recovery",
    status: "available",
    scenarios: 3,
    required_checks: 12,
    feature_drills_resolved: false,
    release_gate_integrated: true,
  });
  assert.deepEqual(evidence.planned_drills, []);

  const inputPaths = evidence.inputs.map((input) => input.path);
  assert.ok(inputPaths.includes("package.json"));
  assert.ok(inputPaths.includes("services/api/scripts/check_seedless_release_foundation.py"));
  assert.ok(inputPaths.includes("services/api/scripts/run_moderation_recovery_drill.py"));
  assert.ok(inputPaths.includes("services/api/scripts/run_privacy_tombstone_recovery_drill.py"));
  assert.ok(inputPaths.includes("services/api/scripts/run_audit_integrity_recovery_drill.py"));
  assert.ok(inputPaths.includes("apps/web/scripts/check-admin-runtime-boundary.mjs"));
  assert.ok(inputPaths.includes("docs/release/frontend-quality-gates-and-visual-verification.md"));
  assert.equal(new Set(inputPaths).size, inputPaths.length);

  for (const input of evidence.inputs) {
    assert.ok(input.bytes > 0, `${input.path} must not be empty`);
    assert.match(input.sha256, /^[0-9a-f]{64}$/);
  }
});

test("immutable evidence id ignores generation metadata", () => {
  const first = buildOperationalReadinessEvidence({
    generatedAt: "2026-08-04T00:00:00.000Z",
    sourceCommit: "first-commit",
  });
  const second = buildOperationalReadinessEvidence({
    generatedAt: "2026-08-05T00:00:00.000Z",
    sourceCommit: "second-commit",
  });

  assert.equal(first.evidence_id, second.evidence_id);
  assert.notEqual(first.generated_at, second.generated_at);
  assert.notEqual(first.source_commit, second.source_commit);
});

test("operational evidence writer emits a machine-readable report without secrets", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "zhipanda-operational-evidence-"));
  const outputPath = path.join(directory, "evidence.json");

  const written = writeOperationalReadinessEvidence(outputPath, {
    generatedAt: "2026-08-04T00:00:00.000Z",
    sourceCommit: "candidate-commit",
  });
  const raw = readFileSync(outputPath, "utf8");
  const parsed = JSON.parse(raw);

  assert.deepEqual(parsed, written);
  assert.doesNotMatch(raw, /sb_secret_/i);
  assert.doesNotMatch(raw, /begin private key/i);
  assert.doesNotMatch(raw, /authorization:\\s*bearer/i);
  assert.equal(parsed.summary.release_gate_integrated, true);
  assert.equal(parsed.summary.planned_drills, 0);
  assert.equal(parsed.operational_controls.final_candidate_controls, 4);
  assert.equal(parsed.recovery_rehearsal.feature_drills_resolved, false);
});
''',
)

replace_once(
    "scripts/release/tests/development.test.mjs",
    "  assert.equal(readiness.planned_drills, 3);\n",
    "  assert.equal(readiness.planned_drills, 0);\n",
)
replace_once(
    "scripts/release/tests/development.test.mjs",
    "  assert.equal(evidence.inputs.length, 26);\n",
    "  assert.ok(evidence.inputs.length > 26);\n",
)

runbook = "docs/runbooks/zhipanda-v1-operational-readiness.md"
replace_once(
    runbook,
    "The dedicated tombstone replay drill remains planned until Issue #198 is merged into the Issue #200 branch. The contract must not mark that drill available or claim evidence before then.",
    "Run `npm run drill:privacy-tombstone-recovery` after a restore or before final-candidate closure. It reapplies the account tombstone against real PostgreSQL, verifies narrow Hold behavior, and proves duplicate replay idempotency without copying database credentials into evidence.",
)
replace_once(
    runbook,
    "**Recovery:** repair source persistence first, then replay projection idempotently, verify rejected-payload evidence, expire encrypted artifacts according to policy, generate a new integrity check, and record the mismatch disposition. The dedicated outage and integrity recovery drill remains planned until Issue #199 is merged into the Issue #200 branch.",
    "**Recovery:** repair source persistence first, then replay projection idempotently, verify rejected-payload evidence, expire encrypted artifacts according to policy, generate a new integrity check, and record the mismatch disposition. Run `npm run drill:audit-integrity-recovery` to verify late-fact mismatch detection, append-only mutation denial, encrypted artifact expiry, and idempotent retention maintenance against real PostgreSQL.",
)
replace_once(
    runbook,
    "## privacy-deletion-retention-and-holds\n",
    "## privacy-deletion-retention-and-holds\n",
)
replace_once(
    runbook,
    "## archive-publication-and-projection\n",
    "## archive-publication-and-projection\n",
)
replace_once(
    runbook,
    "## admin-access-and-security\n",
    "## admin-access-and-security\n",
)
replace_once(
    runbook,
    "The contract remains `in-progress` while any recovery drill is `planned`. It may be marked `complete` only after all planned drills have executable commands and repository evidence, and the existing Release Gate proves the contract from a clean checkout without modifying tracked files.",
    "No feature-specific recovery drill remains `planned`; Moderation, Privacy, and Audit now have executable real PostgreSQL commands and repository evidence. The contract remains `in-progress` until the four final-candidate controls are closed by Extended, Linux, Windows, browser/mobile/WCAG, and published-return evidence through the existing Release Gate.",
)
replace_once(
    runbook,
    "## privacy-deletion-retention-and-holds\n\n**Owner:** Privacy Operations.",
    "## privacy-deletion-retention-and-holds\n\n**Owner:** Privacy Operations.",
)
replace_once(
    runbook,
    "## submission-review-and-scanning\n",
    "## submission-review-and-scanning\n",
)
# Add the Moderation command to the operational index without adding a new SLO section.
replace_once(
    runbook,
    "## privacy-deletion-retention-and-holds\n",
    "### Moderation stop, drain, and restoration drill\n\n"
    "Before final-candidate closure, run `npm run drill:moderation-recovery`. The drill proves the disabled command boundary fails closed before database access, then exercises appeal drain, append-only decision, account-state restoration, scoped enforcement, and projection cleanup against real PostgreSQL.\n\n"
    "## privacy-deletion-retention-and-holds\n",
)

rehearsal_path = ROOT / "contracts/zhipanda-v1-recovery-rehearsal.v1.json"
rehearsal = json.loads(rehearsal_path.read_text(encoding="utf-8"))
real_evidence = {
    197: "services/api/scripts/run_moderation_recovery_drill.py",
    198: "services/api/scripts/run_privacy_tombstone_recovery_drill.py",
    199: "services/api/scripts/run_audit_integrity_recovery_drill.py",
}
for scenario in rehearsal["scenarios"]:
    issue = scenario["blocked_feature_issue"]
    scenario["limitation"] = (
        "Model-level orchestration rehearsal; paired real PostgreSQL evidence is "
        f"provided by {real_evidence[issue]}."
    )
rehearsal["completion_boundary"]["rule"] = (
    "This rehearsal validates recovery orchestration and evidence determinism; "
    "feature-specific real PostgreSQL evidence is provided by the three available "
    "drill commands in the operational-readiness contract."
)
rehearsal_path.write_text(json.dumps(rehearsal, indent=2) + "\n", encoding="utf-8")
