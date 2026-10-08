"use client";

import { useMemo, useState } from "react";

export type AdminV2Domain = "review" | "moderation" | "curation" | "audit";

interface OperationDefinition {
  value: string;
  label: string;
  resourceLabel?: string;
  payloadTemplate?: unknown;
}

const operations: Record<AdminV2Domain, OperationDefinition[]> = {
  review: [
    { value: "review.open", label: "创建审核案件", payloadTemplate: { submissionId: "" } },
    { value: "review.get", label: "查询审核案件", resourceLabel: "审核案件 ID" },
    { value: "review.claim", label: "领取审核案件", resourceLabel: "审核案件 ID" },
    {
      value: "review.verifySource",
      label: "核验来源",
      resourceLabel: "审核案件 ID",
      payloadTemplate: { sourceId: "", outcome: "verified", reason: "Verified against canonical evidence." },
    },
    {
      value: "review.decide",
      label: "保存审核决定",
      resourceLabel: "审核案件 ID",
      payloadTemplate: {
        outcome: "accepted",
        selectedAssertionKeys: [],
        userVisibleExplanation: "Accepted after review.",
      },
    },
    {
      value: "review.recommend",
      label: "推荐策展",
      resourceLabel: "审核案件 ID",
      payloadTemplate: { reason: "Accepted assertions are ready for curation." },
    },
  ],
  moderation: [
    { value: "moderation.getAccount", label: "查询账号治理状态", resourceLabel: "账号 ID" },
    {
      value: "moderation.applySanction",
      label: "执行限制",
      resourceLabel: "账号 ID",
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
      label: "解除限制",
      resourceLabel: "限制记录 ID",
      payloadTemplate: {
        reasonCode: "appeal_review",
        internalExplanation: "Sanction restored after review.",
        userVisibleExplanation: "The sanction has been restored.",
        idempotencyKey: "replace-with-unique-key",
      },
    },
    {
      value: "moderation.decideAppeal",
      label: "处理申诉",
      resourceLabel: "申诉案件 ID",
      payloadTemplate: {
        outcome: "upheld",
        internalExplanation: "Appeal reviewed against the moderation record.",
        userVisibleExplanation: "Your appeal has been reviewed.",
      },
    },
  ],
  curation: [
    { value: "curation.get", label: "查询变更集", resourceLabel: "变更集 ID" },
    { value: "curation.validate", label: "校验变更集", resourceLabel: "变更集 ID" },
    {
      value: "curation.approve",
      label: "批准并应用变更集",
      resourceLabel: "变更集 ID",
      payloadTemplate: { reason: "Reviewed and approved for canonical application." },
    },
  ],
  audit: [
    { value: "audit.list", label: "查看审计证据", payloadTemplate: { limit: 50 } },
  ],
};

const domainCopy: Record<AdminV2Domain, { title: string; description: string }> = {
  review: {
    title: "审核",
    description: "通过 V2 审核接口处理贡献、核验来源和记录决定。",
  },
  moderation: {
    title: "内容治理",
    description: "查询账号限制状态并处理申诉和治理措施。",
  },
  curation: {
    title: "策展",
    description: "查看、验证并批准已有证据支持的正式档案变更集。",
  },
  audit: {
    title: "审计",
    description: "查看仅追加的 V2 审计证据，不提供旧版维护和导出操作。",
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
      setError("请输入有效的 JSON 参数。");
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
      if (!response.ok) setError(`操作失败，HTTP 状态码：${response.status}。`);
    } catch {
      setError("后台操作服务暂时不可用。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-sm font-semibold text-stone-700">PandaAtlas · 数据运营</p>
      <h1 className="mt-1 text-3xl font-bold text-stone-950">{copy.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">{copy.description}</p>

      <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5">
        <label className="grid gap-2 text-sm font-semibold text-stone-900">
          操作类型
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
          JSON 参数
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
          {busy ? "正在执行…" : "执行操作"}
        </button>
      </section>

      {error ? <p className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</p> : null}
      {status !== null ? (
        <section className="mt-6 rounded-xl border border-stone-300 bg-stone-950 p-5 text-stone-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">HTTP {status}</div>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm">{pretty(result)}</pre>
        </section>
      ) : null}
    </div>
  );
}
