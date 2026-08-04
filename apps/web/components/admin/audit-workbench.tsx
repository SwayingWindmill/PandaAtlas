"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

type AuditEvent = {
  event_id: string;
  source_context: string;
  action: string;
  target_type: string;
  target_id: string;
  actor_account_id: string | null;
  result: string;
  reason: string;
  sensitive_read: boolean;
  bulk_count: number;
  occurred_at: string;
};

type AuditMetrics = {
  projected_event_count: number;
  source_projection_gap_count: number;
  sensitive_read_count_24h: number;
  bulk_sensitive_read_count_24h: number;
  rejected_payload_count_24h: number;
  export_event_count_24h: number;
  expired_export_artifact_count: number;
  maintenance_run_count_24h: number;
  integrity_mismatch_count_24h: number;
  latest_integrity_generated_at: string | null;
  alerts: string[];
};

type IntegritySummary = {
  summary_id: string;
  range_started_at: string;
  range_ended_at: string;
  event_count: number;
  digest_sha256: string;
  generated_at: string;
};

type ExportArtifact = {
  artifact_id: string;
  scope_hash: string;
  file_sha256: string;
  row_count: number;
  byte_size: number;
  created_at: string;
  expires_at: string;
};

type AdminSession = { capabilities: string[] };

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "Audit 操作失败。";
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | { detail?: string | { code?: string; message?: string } }
    | T
    | null;
  if (response.ok) return body as T;
  const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
  if (typeof detail === "string") throw new Error(detail);
  if (detail && typeof detail === "object") {
    throw new Error(detail.message ?? detail.code ?? `Audit 服务返回 ${response.status}`);
  }
  throw new Error(`Audit 服务返回 ${response.status}`);
}

async function auditFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parseJson<T>(
    await fetch(`/api/admin/audit/${path}`, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    }),
  );
}

function localInput(hoursAgo: number): string {
  const value = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export function AuditWorkbench() {
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [reason, setReason] = useState("Review bounded Audit evidence");
  const [sourceContext, setSourceContext] = useState("");
  const [action, setAction] = useState("");
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null);
  const [summaries, setSummaries] = useState<IntegritySummary[]>([]);
  const [artifact, setArtifact] = useState<ExportArtifact | null>(null);
  const [rangeStart, setRangeStart] = useState(() => localInput(24));
  const [rangeEnd, setRangeEnd] = useState(() => localInput(1));
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canExport = capabilities.includes("audit.export");
  const canIntegrity = capabilities.includes("audit.integrity.manage");
  const canMaintain = capabilities.includes("audit.maintain");

  const eventQuery = useMemo(() => {
    const query = new URLSearchParams({ reason, limit: "100" });
    if (sourceContext.trim()) query.set("source_context", sourceContext.trim());
    if (action.trim()) query.set("action", action.trim());
    if (sensitiveOnly) query.set("sensitive_only", "true");
    return query.toString();
  }, [action, reason, sensitiveOnly, sourceContext]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reasonQuery = encodeURIComponent(reason);
      const [eventResult, metricResult, summaryResult] = await Promise.all([
        auditFetch<{ items: AuditEvent[] }>(`events?${eventQuery}`),
        auditFetch<AuditMetrics>(`metrics?reason=${reasonQuery}`),
        auditFetch<{ items: IntegritySummary[] }>(
          `integrity-summaries?reason=${reasonQuery}&limit=20`,
        ),
      ]);
      setEvents(eventResult.items);
      setMetrics(metricResult);
      setSummaries(summaryResult.items);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [eventQuery, reason]);

  useEffect(() => {
    fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => parseJson<AdminSession>(response))
      .then((session) => setCapabilities(session.capabilities))
      .catch((cause) => setError(errorMessage(cause)));
  }, []);

  async function runCommand<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      return await auditFetch<T>(path, { method: "POST", body: JSON.stringify(payload) });
    } finally {
      setWorking(false);
    }
  }

  async function createExport() {
    try {
      const result = await runCommand<ExportArtifact>("exports", {
        scope: {
          source_context: sourceContext.trim() || null,
          action: action.trim() || null,
          sensitive_only: sensitiveOnly || null,
        },
        reason,
        expires_in_seconds: 3600,
        idempotency_key: `audit-export-${crypto.randomUUID()}`,
      });
      setArtifact(result);
      setNotice(`已生成 ${result.row_count} 条记录的加密导出。`);
      await loadOverview();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function downloadExport() {
    if (!artifact) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/audit/exports/${artifact.artifact_id}/download?reason=${encodeURIComponent(reason)}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      if (!response.ok) {
        await parseJson<never>(response);
        return;
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `audit-export-${artifact.artifact_id}.ndjson`;
      link.click();
      URL.revokeObjectURL(href);
      setNotice(`已下载并审计文件 ${artifact.file_sha256.slice(0, 16)}…`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function generateSummary() {
    try {
      const result = await runCommand<IntegritySummary>("integrity-summaries", {
        range_started_at: new Date(rangeStart).toISOString(),
        range_ended_at: new Date(rangeEnd).toISOString(),
        reason,
        idempotency_key: `audit-summary-${crypto.randomUUID()}`,
      });
      setNotice(`已封存 ${result.event_count} 条事件的完整性摘要。`);
      await loadOverview();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function verifySummary(summaryId: string) {
    try {
      const result = await runCommand<{ matched: boolean }>(
        `integrity-summaries/${summaryId}/verify`,
        { reason, idempotency_key: `audit-verify-${crypto.randomUUID()}` },
      );
      setNotice(result.matched ? "完整性摘要匹配。" : "检测到完整性不匹配。\n");
      await loadOverview();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function runRetention() {
    try {
      const result = await runCommand<{ expired_export_count: number }>(
        "maintenance/retention",
        { reason, idempotency_key: `audit-retention-${crypto.randomUUID()}` },
      );
      setNotice(`已清理 ${result.expired_export_count} 个过期密文导出。`);
      await loadOverview();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">Unified Audit</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">Audit Operator 工作台</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            搜索只读证据、检查指标与摘要，并通过显式 FastAPI 命令生成加密导出或清理已过期密文。通用 CRUD 始终禁用。
          </p>
        </div>
        <Link className="text-sm font-semibold text-stone-800 underline" to="/">
          返回权限控制台
        </Link>
      </div>

      {error ? <p role="alert" className="mt-5 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950">{error}</p> : null}
      {notice ? <p role="status" className="mt-5 rounded-lg border border-emerald-700 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p> : null}

      <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5">
        <h2 className="text-xl font-bold text-stone-950">搜索与读取理由</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-semibold text-stone-800 lg:col-span-2">理由
            <input className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <label className="text-sm font-semibold text-stone-800">来源上下文
            <input className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={sourceContext} onChange={(event) => setSourceContext(event.target.value)} placeholder="activity" />
          </label>
          <label className="text-sm font-semibold text-stone-800">动作
            <input className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={action} onChange={(event) => setAction(event.target.value)} placeholder="audit.export.download" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-800">
            <input type="checkbox" checked={sensitiveOnly} onChange={(event) => setSensitiveOnly(event.target.checked)} />
            仅敏感读取
          </label>
          <Button disabled={loading || reason.trim().length < 3} onClick={() => void loadOverview()}>刷新证据</Button>
        </div>
      </section>

      {metrics ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Audit metrics">
          {[
            ["投影事件", metrics.projected_event_count],
            ["投影缺口", metrics.source_projection_gap_count],
            ["24h 敏感读取", metrics.sensitive_read_count_24h],
            ["过期导出", metrics.expired_export_artifact_count],
            ["24h 导出事件", metrics.export_event_count_24h],
            ["24h 维护运行", metrics.maintenance_run_count_24h],
            ["完整性不匹配", metrics.integrity_mismatch_count_24h],
            ["告警", metrics.alerts.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-stone-300 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">{label}</p>
              <p className="mt-2 text-2xl font-bold text-stone-950">{value}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-stone-300 bg-white p-5">
        <h2 className="text-xl font-bold text-stone-950">统一事件</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-stone-300"><th className="p-2">时间</th><th className="p-2">上下文</th><th className="p-2">动作</th><th className="p-2">目标</th><th className="p-2">结果</th><th className="p-2">敏感</th></tr></thead>
            <tbody>{events.map((event) => (
              <tr key={event.event_id} className="border-b border-stone-200 align-top"><td className="p-2">{new Date(event.occurred_at).toLocaleString()}</td><td className="p-2 font-mono">{event.source_context}</td><td className="p-2 font-mono">{event.action}</td><td className="p-2 break-all">{event.target_type}:{event.target_id}</td><td className="p-2">{event.result}</td><td className="p-2">{event.sensitive_read ? "是" : "否"}</td></tr>
            ))}</tbody>
          </table>
        </div>
        {!loading && events.length === 0 ? <p className="mt-4 text-sm text-stone-700">当前范围没有事件。</p> : null}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-300 bg-white p-5">
          <h2 className="text-xl font-bold text-stone-950">加密导出</h2>
          <p className="mt-2 text-sm text-stone-700">导出当前结构化筛选，最长保留 1 小时；生成和下载分别留痕。</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button disabled={!canExport || working} onClick={() => void createExport()}>生成加密导出</Button>
            <Button variant="outline" disabled={!artifact || working} onClick={() => void downloadExport()}>下载 NDJSON</Button>
          </div>
          {artifact ? <dl className="mt-4 grid gap-2 text-sm"><div><dt className="font-semibold">文件哈希</dt><dd className="break-all font-mono">{artifact.file_sha256}</dd></div><div><dt className="font-semibold">记录数</dt><dd>{artifact.row_count}</dd></div><div><dt className="font-semibold">到期</dt><dd>{new Date(artifact.expires_at).toLocaleString()}</dd></div></dl> : null}
        </section>

        <section className="rounded-xl border border-stone-300 bg-white p-5">
          <h2 className="text-xl font-bold text-stone-950">保留维护</h2>
          <p className="mt-2 text-sm text-stone-700">仅删除数据库确认已到期的加密导出，不删除 Audit 事实或摘要。</p>
          <Button className="mt-4" disabled={!canMaintain || working} onClick={() => void runRetention()}>清理过期密文</Button>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-stone-300 bg-white p-5">
        <h2 className="text-xl font-bold text-stone-950">完整性摘要</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-stone-800">开始时间<input type="datetime-local" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></label>
          <label className="text-sm font-semibold text-stone-800">结束时间<input type="datetime-local" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} /></label>
        </div>
        <Button className="mt-4" disabled={!canIntegrity || working} onClick={() => void generateSummary()}>生成封闭窗口摘要</Button>
        <ul className="mt-5 grid gap-3">{summaries.map((summary) => (
          <li key={summary.summary_id} className="rounded-lg border border-stone-300 p-4 text-sm"><p className="font-mono text-xs break-all">{summary.digest_sha256}</p><p className="mt-2 text-stone-700">{summary.event_count} 条事件 · {new Date(summary.range_started_at).toLocaleString()} — {new Date(summary.range_ended_at).toLocaleString()}</p><Button variant="outline" className="mt-3" disabled={!canIntegrity || working} onClick={() => void verifySummary(summary.summary_id)}>重新验证</Button></li>
        ))}</ul>
      </section>
    </main>
  );
}
