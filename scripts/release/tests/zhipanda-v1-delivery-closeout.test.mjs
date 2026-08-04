import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  defaultContractPath,
  validateZhiPandaV1DeliveryCloseout,
} from "../check-zhipanda-v1-delivery-closeout.mjs";

function loadContract() {
  return JSON.parse(readFileSync(defaultContractPath, "utf8"));
}

function withContract(mutator, assertion) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "zhipanda-v1-closeout-"));
  const contractPath = path.join(directory, "contract.json");
  try {
    const contract = loadContract();
    mutator(contract);
    writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
    assertion(contractPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("Issue #201 closeout contract records passed repository gates without claiming launch completion", () => {
  const result = validateZhiPandaV1DeliveryCloseout();
  assert.equal(result.status, "PASS");
  assert.equal(result.contract_status, "in-progress");
  assert.equal(result.decision_status, "pending");
  assert.equal(result.prerequisite_count, 8);
  assert.equal(result.domain_count, 5);
  assert.equal(result.repository_gate_count, 5);
  assert.deepEqual(result.pending_gate_ids, [
    "extended-real-service",
    "vercel-api-final-preview",
    "vercel-web-final-preview",
  ]);
});

test("GO remains fail closed while any final gate or external requirement is pending", () => {
  withContract(
    (contract) => {
      contract.launch_decision = {
        ...contract.launch_decision,
        status: "go",
        owner: "Launch owner",
        decided_at: "2026-08-04T12:00:00Z",
        version: "v1.0.0",
        evidence_sha256: "a".repeat(64),
        reason: "All evidence passed",
      };
    },
    (contractPath) => {
      assert.throws(
        () => validateZhiPandaV1DeliveryCloseout({ contractPath }),
        /GO decision is forbidden until every domain, gate, and external requirement passes/,
      );
    },
  );
});

test("complete closeout cannot retain a pending launch decision", () => {
  withContract(
    (contract) => {
      contract.status = "complete";
    },
    (contractPath) => {
      assert.throws(
        () => validateZhiPandaV1DeliveryCloseout({ contractPath }),
        /Complete delivery closeout cannot retain a pending launch decision/,
      );
    },
  );
});

test("the closed-loop domain inventory remains exhaustive", () => {
  withContract(
    (contract) => {
      contract.closed_loop_domains = contract.closed_loop_domains.filter(
        (entry) => entry.id !== "moderation-privacy-audit",
      );
    },
    (contractPath) => {
      assert.throws(
        () => validateZhiPandaV1DeliveryCloseout({ contractPath }),
        /closed-loop domain inventory mismatch/,
      );
    },
  );
});

test("the closeout evidence contract rejects secret-bearing fields", () => {
  withContract(
    (contract) => {
      contract.external_requirements[0].database_url = "postgresql://operator:credential@example.invalid/db";
    },
    (contractPath) => {
      assert.throws(
        () => validateZhiPandaV1DeliveryCloseout({ contractPath }),
        /Sensitive key is forbidden/,
      );
    },
  );
});

test("final decisions require the full rollback-switch inventory", () => {
  withContract(
    (contract) => {
      contract.launch_decision.rollback_switches = contract.launch_decision.rollback_switches.filter(
        (entry) => entry !== "PRIVACY_OPERATIONS_ENABLED",
      );
    },
    (contractPath) => {
      assert.throws(
        () => validateZhiPandaV1DeliveryCloseout({ contractPath }),
        /launch rollback switch inventory mismatch/,
      );
    },
  );
});
