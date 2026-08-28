"use client";

import { useMemo, useState } from "react";

export type AdminV2Domain = "review" | "moderation" | "curation" | "publication" | "audit";

interface OperationDefinition {
  value: string;
  label: string;
  resourceLabel?: string;
  payloadTemplate?: unknown;
}

const operations: Record<AdminV2Domain, OperationDefinition[]> = {
  review: [
    { value: "review.open", label: "Open review case", payloadTemplate: { submissionId: "" } },
    { value: "review.get", label: "Get review case", resourceLabel: "Review case ID" },
    { value: "review.claim", label: "Claim review case", resourceLabel: "Review case ID" },
    {
      value: "review.verifySource",
      label: "Verify source",
      resourceLabel: "Review case ID",
      payloadTemplate: { sourceId: "", outcome: "verified", reason: "Verified against canonical evidence." },
    },
    {
      value: "review.decide",
      label: "Record decision",
      resourceLabel: "Review case ID",
      payloadTemplate: {
        outcome: "accepted",
        selectedAssertionKeys: [],
        userVisibleExplanation: "Accepted after review.",
      },
    },
    {
      value: "review.recommend",
      label: "Recommend for curation",
      resourceLabel: "Review case ID",
      payloadTemplate: { reason: "Accepted assertions are ready for curation." },
    },
  ],
  moderation: [
    { value: "moderation.getAccount", label: "Get moderation account", resourceLabel: "Account ID" },
    {
      value: "moderation.applySanction",
      label: "Apply sanction",
      resourceLabel: "Account ID",
      payloadTemplate: {
        kind: "warning",
        reasonCode: "policy_warning",
        internalExplanation: "Internal moderation explanation.",
        userVisibleExplanation: "A moderation warning was applied to this account.",
        idempotencyKey: "replace-with-unique-key",
      },
    },
    {
      value: "moderation.restoreSanction",
      label: "Restore sanction",
      resourceLabel: "Sanction ID",
      payloadTemplate: {
        reasonCode: "appeal_review",
        internalExplanation: "Sanction restored after review.",
        userVisibleExplanation: "The sanction has been restored.",
        idempotencyKey: "replace-with-unique-key",
      },
    },
    {
      value: "moderation.decideAppeal",
      label: "Decide appeal",
      resourceLabel: "Appeal case ID",
      payloadTemplate: {
        outcome: "upheld",
        internalExplanation: "Appeal reviewed against the moderation record.",
        userVisibleExplanation: "Your appeal has been reviewed.",
      },
    },
  ],
  curation: [
    { value: "curation.get", label: "Get change set", resourceLabel: "Change set ID" },
    { value: "curation.validate", label: "Validate change set", resourceLabel: "Change set ID" },
    {
      value: "curation.approve",
      label: "Approve and apply change set",
      resourceLabel: "Change set ID",
      payloadTemplate: { reason: "Reviewed and approved for canonical application." },
    },
  ],
  publication: [
    { value: "publication.getRelease", label: "Get release", resourceLabel: "Release ID" },
    { value: "publication.build", label: "Build release", payloadTemplate: { version: "2026.08.28.1" } },
    { value: "publication.seal", label: "Seal release", resourceLabel: "Release ID", payloadTemplate: { reason: "Release membership reviewed." } },
    { value: "publication.activate", label: "Activate release", resourceLabel: "Release ID", payloadTemplate: { reason: "Release approved for activation." } },
    { value: "publication.rollback", label: "Rollback to release", resourceLabel: "Release ID", payloadTemplate: { reason: "Rollback required after verification." } },
    { value: "publication.suspend", label: "Suspend release", resourceLabel: "Release ID", payloadTemplate: { reason: "Emergency release suspension." } },
    { value: "publication.restore", label: "Restore release", resourceLabel: "Release ID", payloadTemplate: { reason: "Release suspension cleared." } },
    {
      value: "publication.takeDownResource",
      label: "Take down resource",
      payloadTemplate: { resourceKind: "panda", resourceId: "", reason: "Emergency resource takedown." },
    },
    {
      value: "publication.restoreResource",
      label: "Restore resource",
      payloadTemplate: { resourceKind: "panda", resourceId: "", reason: "Emergency resource restoration." },
    },
  ],
  audit: [
    { value: "audit.list", label: "List V2 audit evidence", payloadTemplate: { limit: 50 } },
  ],
};

const domainCopy: Record<AdminV2Domain, { title: string; description: string }> = {
  review: {
    title: "Review",
    description: "Open, claim, verify, decide, and recommend contribution review cases through canonical V2 commands.",
  },
  moderation: {
    title: "Moderation",
    description: "Inspect account moderation state and perform scoped sanction or appeal commands through V2.",
  },
  curation: {
    title: "Curation",
    description: "Inspect, validate, and approve recommendation-backed canonical change sets.",
  },
  publication: {
    title: "Publication",
    description: "Build, seal, activate, roll back, suspend, restore, and apply narrow emergency resource controls.",
  },
  audit: {
    title: "Audit",
    description: "Read append-only V2 audit evidence. Export and legacy maintenance operations are intentionally not exposed.",
  },
};

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function AdminV2OperationsWorkbench({ domain }: { domain: AdminV2Domain }) {
  const definitions = operations[domain];
  const [operation, setOperation] = useState(definitions[0]?.value ?? "");
  const definition = useMemo(
    () => definitions.find((candidate) => candidate.value === operation) ?? definitions[0],
    [definitions, operation],
  );
  const [resourceId, setResourceId] = useState("");
  const [payloadText, setPayloadText] = useState(() => pretty(definitions[0]?.payloadTemplate ?? {}));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = domainCopy[domain];

  function selectOperation(nextOperation: string) {
    const next = definitions.find((candidate) => candidate.value === nextOperation);
    setOperation(nextOperation);
    setResourceId("");
    setPayloadText(pretty(next?.payloadTemplate ?? {}));
    setResult(null);
    setStatus(null);
    setError(null);
  }

  async function execute() {
    setBusy(true);
    setError(null);
    setResult(null);
    setStatus(null);
    let payload: unknown;
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : {};
    } catch {
      setError("Payload must be valid JSON.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          ...(resourceId.trim() ? { resourceId: resourceId.trim() } : {}),
          payload,
        }),
      });
      setStatus(response.status);
      const text = await response.text();
      if (text) {
        try {
          setResult(JSON.parse(text));
        } catch {
          setResult(text);
        }
      } else {
        setResult({ ok: response.ok });
      }
      if (!response.ok) setError(`Operation failed with HTTP ${response.status}.`);
    } catch {
      setError("Admin V2 operation service is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-sm font-semibold text-stone-700">ZhiPanda Administration · V2</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">{copy.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">{copy.description}</p>

      <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5">
        <label className="grid gap-2 text-sm font-semibold text-stone-900">
          Operation
          <select
            className="min-h-11 rounded-md border border-stone-400 bg-white px-3"
            value={operation}
            onChange={(event) => selectOperation(event.target.value)}
          >
            {definitions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        {definition?.resourceLabel ? (
          <label className="mt-5 grid gap-2 text-sm font-semibold text-stone-900">
            {definition.resourceLabel}
            <input
              className="min-h-11 rounded-md border border-stone-400 px-3 font-mono text-sm"
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
              autoComplete="off"
            />
          </label>
        ) : null}

        <label className="mt-5 grid gap-2 text-sm font-semibold text-stone-900">
          JSON payload
          <textarea
            className="min-h-48 rounded-md border border-stone-400 p-3 font-mono text-sm"
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            spellCheck={false}
          />
        </label>

        <button
          type="button"
          className="mt-5 min-h-11 rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={busy}
          onClick={() => void execute()}
        >
          {busy ? "Running…" : "Run V2 operation"}
        </button>
      </section>

      {error ? <p className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</p> : null}
      {status !== null ? (
        <section className="mt-6 rounded-xl border border-stone-300 bg-stone-950 p-5 text-stone-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">HTTP {status}</div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm">{pretty(result)}</pre>
        </section>
      ) : null}
    </main>
  );
}
