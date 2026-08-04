import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(scriptDir, "..", "..");
export const defaultReportPath = path.join(
  repositoryRoot,
  ".release-gate",
  "zhipanda-v1-recovery-rehearsal.json",
);

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function check(id, passed, evidence) {
  return { id, passed: Boolean(passed), evidence };
}

function appendEvent(journal, event) {
  journal.push({ sequence: journal.length + 1, ...event });
}

function projectEvents(journal, apply) {
  const applied = new Set();
  const projection = {};
  let duplicateEvents = 0;

  for (const event of [...journal, ...journal]) {
    if (applied.has(event.event_id)) {
      duplicateEvents += 1;
      continue;
    }
    applied.add(event.event_id);
    apply(projection, event);
  }

  return {
    projection,
    applied_event_ids: [...applied].sort(),
    duplicate_events_ignored: duplicateEvents,
  };
}

function moderationScenario() {
  const journal = [];
  const commandState = { enabled: true };

  appendEvent(journal, {
    event_id: "moderation-001",
    type: "sanction.created",
    sanction_id: "sanction-1",
    scope: "submission",
  });
  appendEvent(journal, {
    event_id: "moderation-002",
    type: "appeal.opened",
    sanction_id: "sanction-1",
  });

  const beforeStopCount = journal.length;
  commandState.enabled = false;
  const stoppedCommandAccepted = commandState.enabled;
  if (stoppedCommandAccepted) {
    appendEvent(journal, {
      event_id: "moderation-invalid",
      type: "sanction.created",
      sanction_id: "sanction-2",
      scope: "account",
    });
  }

  appendEvent(journal, {
    event_id: "moderation-003",
    type: "appeal.overturned",
    sanction_id: "sanction-1",
  });
  appendEvent(journal, {
    event_id: "moderation-004",
    type: "sanction.restored",
    sanction_id: "sanction-1",
  });

  const replay = projectEvents(journal, (projection, event) => {
    const current = projection[event.sanction_id] ?? {
      active: false,
      appeal_state: null,
      restored: false,
    };
    if (event.type === "sanction.created") current.active = true;
    if (event.type === "appeal.opened") current.appeal_state = "open";
    if (event.type === "appeal.overturned") {
      current.active = false;
      current.appeal_state = "overturned";
    }
    if (event.type === "sanction.restored") current.restored = true;
    projection[event.sanction_id] = current;
  });

  const sanction = replay.projection["sanction-1"];
  const checks = [
    check(
      "new-commands-stop-fail-closed",
      stoppedCommandAccepted === false && journal.length === beforeStopCount + 2,
      { stopped_command_accepted: stoppedCommandAccepted },
    ),
    check(
      "in-flight-appeal-drains",
      sanction?.appeal_state === "overturned" && sanction?.restored === true,
      sanction,
    ),
    check(
      "projection-replay-is-idempotent",
      replay.applied_event_ids.length === journal.length
        && replay.duplicate_events_ignored === journal.length,
      {
        applied: replay.applied_event_ids.length,
        duplicates_ignored: replay.duplicate_events_ignored,
      },
    ),
  ];

  return {
    id: "moderation-stop-drain-orchestration",
    limitation: "Model-level orchestration rehearsal; the Issue #197 real PostgreSQL drill remains required.",
    journal,
    result: replay,
    checks,
  };
}

function privacyScenario() {
  const restoreSnapshot = {
    account: { authentication: "active" },
    contexts: {
      archive_provenance: "retained",
      community_intake: "present",
      engagement: "present",
      notification: "present",
    },
  };
  const state = structuredClone(restoreSnapshot);
  const tombstone = {
    tombstone_id: "privacy-tombstone-1",
    account_id: "account-1",
    held_contexts: ["archive_provenance"],
    delete_contexts: ["community_intake", "engagement", "notification"],
  };

  function applyTombstone(target) {
    target.account.authentication = "blocked";
    for (const context of tombstone.delete_contexts) {
      target.contexts[context] = "deleted";
    }
    for (const context of tombstone.held_contexts) {
      target.contexts[context] = "retained-under-hold";
    }
  }

  applyTombstone(state);
  const firstApplication = structuredClone(state);

  Object.assign(state.account, restoreSnapshot.account);
  state.contexts = structuredClone(restoreSnapshot.contexts);
  const resurrectedAfterRestore = state.contexts.engagement === "present";

  applyTombstone(state);
  const afterReplay = structuredClone(state);
  applyTombstone(state);
  const afterDuplicateReplay = structuredClone(state);

  const checks = [
    check(
      "confirmed-deletion-blocks-authentication",
      firstApplication.account.authentication === "blocked",
      firstApplication.account,
    ),
    check(
      "restore-demonstrates-replay-need",
      resurrectedAfterRestore,
      { engagement_after_restore: restoreSnapshot.contexts.engagement },
    ),
    check(
      "tombstone-replay-deletes-only-non-held-contexts",
      afterReplay.contexts.archive_provenance === "retained-under-hold"
        && tombstone.delete_contexts.every(
          (context) => afterReplay.contexts[context] === "deleted",
        ),
      afterReplay.contexts,
    ),
    check(
      "duplicate-tombstone-replay-is-idempotent",
      canonicalize(afterReplay) === canonicalize(afterDuplicateReplay),
      afterDuplicateReplay,
    ),
  ];

  return {
    id: "privacy-tombstone-replay-orchestration",
    limitation: "Model-level orchestration rehearsal; the Issue #198 real PostgreSQL and restore drill remains required.",
    tombstone,
    restore_snapshot: restoreSnapshot,
    result: afterReplay,
    checks,
  };
}

function auditScenario() {
  const businessState = { accepted_commands: [] };
  const sourceFacts = [];
  const auditProjection = [];
  let auditPersistenceAvailable = false;

  function executeRequiredAuditCommand(command) {
    if (!auditPersistenceAvailable) {
      return { accepted: false, reason: "required-audit-unavailable" };
    }
    businessState.accepted_commands.push(command.command_id);
    sourceFacts.push({
      event_id: `audit-${sourceFacts.length + 1}`,
      command_id: command.command_id,
      action: command.action,
      detail_hash: sha256(canonicalize(command.detail)),
    });
    return { accepted: true };
  }

  const rejected = executeRequiredAuditCommand({
    command_id: "command-1",
    action: "sensitive.export",
    detail: { subject_id: "subject-1" },
  });

  auditPersistenceAvailable = true;
  const accepted = executeRequiredAuditCommand({
    command_id: "command-2",
    action: "sensitive.export",
    detail: { subject_id: "subject-2" },
  });

  function rebuildProjection() {
    const existing = new Set(auditProjection.map((event) => event.event_id));
    for (const fact of sourceFacts) {
      if (!existing.has(fact.event_id)) auditProjection.push(structuredClone(fact));
    }
  }

  rebuildProjection();
  rebuildProjection();
  const expectedDigest = sha256(canonicalize(auditProjection));
  const tamperedProjection = structuredClone(auditProjection);
  tamperedProjection[0].detail_hash = "0".repeat(64);
  const tamperedDigest = sha256(canonicalize(tamperedProjection));

  const exportFacts = [{ export_id: "export-1", audit_event_retained: true }];
  const exportArtifacts = [{
    export_id: "export-1",
    ciphertext: "encrypted-placeholder",
    expires_at: "2026-08-04T01:00:00.000Z",
  }];
  const maintenanceAt = "2026-08-04T02:00:00.000Z";
  const retainedArtifacts = exportArtifacts.filter(
    (artifact) => artifact.expires_at > maintenanceAt,
  );

  const checks = [
    check(
      "required-audit-outage-fails-closed",
      rejected.accepted === false && businessState.accepted_commands.length === 1,
      {
        rejected,
        accepted_commands: businessState.accepted_commands,
      },
    ),
    check(
      "audit-projection-rebuild-is-idempotent",
      auditProjection.length === sourceFacts.length,
      { source_facts: sourceFacts.length, projected: auditProjection.length },
    ),
    check(
      "integrity-mismatch-is-detected",
      expectedDigest !== tamperedDigest,
      { expected_digest: expectedDigest, tampered_digest: tamperedDigest },
    ),
    check(
      "expired-export-ciphertext-is-removed-but-fact-remains",
      retainedArtifacts.length === 0 && exportFacts[0].audit_event_retained === true,
      { retained_artifacts: retainedArtifacts.length, export_facts: exportFacts.length },
    ),
    check("healthy-required-audit-command-succeeds", accepted.accepted, accepted),
  ];

  return {
    id: "audit-integrity-recovery-orchestration",
    limitation: "Model-level orchestration rehearsal; the Issue #199 real PostgreSQL fail-closed and digest drill remains required.",
    source_facts: sourceFacts,
    result: {
      business_state: businessState,
      projection: auditProjection,
      expected_digest: expectedDigest,
      tampered_digest: tamperedDigest,
      expired_artifacts_removed: exportArtifacts.length - retainedArtifacts.length,
    },
    checks,
  };
}

export function runRecoveryRehearsal({ generatedAt = new Date().toISOString() } = {}) {
  const scenarios = [
    moderationScenario(),
    privacyScenario(),
    auditScenario(),
  ];
  const checks = scenarios.flatMap((scenario) =>
    scenario.checks.map((item) => ({ scenario: scenario.id, ...item })),
  );
  const failedChecks = checks.filter((item) => !item.passed);
  const evidencePayload = {
    schema_version: 1,
    rehearsal_id: "zhipanda-v1-cross-feature-recovery",
    scenarios,
  };

  return {
    ...evidencePayload,
    generated_at: generatedAt,
    evidence_id: sha256(canonicalize(evidencePayload)),
    outcome: failedChecks.length === 0 ? "passed" : "failed",
    summary: {
      scenarios: scenarios.length,
      checks: checks.length,
      passed: checks.length - failedChecks.length,
      failed: failedChecks.length,
      limitations: scenarios.map((scenario) => scenario.limitation),
    },
  };
}

export function writeRecoveryRehearsal({
  outputPath = defaultReportPath,
  generatedAt,
} = {}) {
  const report = runRecoveryRehearsal({ generatedAt });
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 && process.argv[outputIndex + 1]
    ? path.resolve(process.argv[outputIndex + 1])
    : defaultReportPath;
  const report = writeRecoveryRehearsal({ outputPath });
  process.stdout.write(`${JSON.stringify({
    outcome: report.outcome,
    evidence_id: report.evidence_id,
    report: path.relative(repositoryRoot, outputPath),
    summary: report.summary,
  }, null, 2)}\n`);
  if (report.outcome !== "passed") process.exitCode = 1;
}
