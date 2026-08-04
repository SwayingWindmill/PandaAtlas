"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type PrivacyRequestKind = "access_export" | "account_deletion";
type PrivacyRequestState = "requested" | "verified" | "processing" | "completed" | "failed";
type PrivacyContextState =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "held"
  | "not_applicable";

type PrivacyContext = {
  context_key: string;
  state: PrivacyContextState;
  attempts: number;
  updated_at: string;
  version: number;
  last_error_code: string | null;
};

type PrivacyRequest = {
  request_id: string;
  kind: PrivacyRequestKind;
  state: PrivacyRequestState;
  version: number;
  requested_at: string;
  completed_at: string | null;
  account_id: string;
  requested_reason: string;
  verified_by_account_id: string | null;
  verified_at: string | null;
  processing_started_at: string | null;
  failed_at: string | null;
  failure_code: string | null;
  contexts: PrivacyContext[];
};

type PrivacyHold = {
  hold_id: string;
  request_id: string;
  account_id: string;
  context_key: string;
  basis: "legal_obligation" | "security_investigation" | "fraud_prevention";
  state: "active" | "released";
  version: number;
  created_by_account_id: string;
  created_at: string;
  review_due_at: string;
  released_by_account_id: string | null;
  released_at: string | null;
  release_reason: "basis_resolved" | "review_expired" | "superseded" | null;
};

type PrivacyMetrics = {
  open_request_count: number;
  oldest_open_request_age_seconds: number;
  failed_context_count: number;
  orphan_attachment_count: number;
  overdue_hold_review_count: number;
  expired_export_payload_count: number;
  tombstone_account_count: number;
  tombstone_replay_count_24h: number;
  export_access_grant_count_24h: number;
  export_download_count_24h: number;
  completed_request_count_24h: number;
  alerts: string[];
};

type MaintenanceResult = {
  run_id: string;
  started_at: string;
  completed_at: string;
  replay_tombstones_after_restore: boolean;
  counts: Record<string, number>;
};

const REQUEST_STATES: Array<{ value: "all" | PrivacyRequestState; label: string }> = [
  { value: "all", label: "全部" },
  { value: "requested", label: "待验证" },
  { value: "verified", label: "已验证" },
  { value: "processing", label: "处理中" },
  { value: "failed", label: "失败" },
  { value: "completed", label: "已完成" },
];

const PRIVATE_DELETION_CONTEXTS = ["engagement", "community_intake", "notification"];
const FINAL_DELETION_CONTEXTS = ["archive_provenance", "identity_access"];

function commandKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "Privacy 操作失败。";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown } | T | null;
  if (response.ok) return body as T;
  const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
  if (typeof detail === "string") throw new Error(detail);
  throw new Error(`Privacy 服务返回 ${response.status}`);
}

async function privacyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse<T>(
    await fetch(`/api/admin/privacy${path}`, {
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时`;
  return `${Math.round(seconds / 86400)} 天`;
}

function contextVersions(detail: PrivacyRequest, names?: string[]): Record<string, number> {
  const allowed = names ? new Set(names) : null;
  return Object.fromEntries(
    detail.contexts
      .filter((context) => !allowed || allowed.has(context.context_key))
      .map((context) => [context.context_key, context.version]),
  );
}

function MetricCard({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return (
    <div className="rounded-lg border border-stone-300 bg-white p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">{label}</dt>
      <dd className="mt-2 text-2xl font-bold text-stone-950">{value}</dd>
    </div>
  );
}

export function PrivacyWorkbench() {
  const [items, setItems] = useState<PrivacyRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PrivacyRequest | null>(null);
  const [holds, setHolds] = useState<PrivacyHold[]>([]);
  const [metrics, setMetrics] = useState<PrivacyMetrics | null>(null);
  const [stateFilter, setStateFilter] = useState<"all" | PrivacyRequestState>("all");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failureCode, setFailureCode] = useState("privacy_context_failed");
  const [holdContext, setHoldContext] = useState("");
  const [holdBasis, setHoldBasis] = useState<PrivacyHold["basis"]>("legal_obligation");
  const [holdDue, setHoldDue] = useState("");
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [maintenanceResult, setMaintenanceResult] = useState<MaintenanceResult | null>(null);

  const filteredItems = useMemo(
    () => items.filter((item) => stateFilter === "all" || item.state === stateFilter),
    [items, stateFilter],
  );

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queue, snapshot] = await Promise.all([
        privacyFetch<{ items: PrivacyRequest[] }>("/requests"),
        privacyFetch<PrivacyMetrics>("/metrics"),
      ]);
      setItems(queue.items);
      setMetrics(snapshot);
      setSelectedId((current) =>
        current && queue.items.some((item) => item.request_id === current)
          ? current
          : (queue.items[0]?.request_id ?? null),
      );
    } catch (cause) {
      setError(errorMessage(cause));
      setItems([]);
      setMetrics(null);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (requestId: string) => {
    setError(null);
    try {
      const [request, holdList] = await Promise.all([
        privacyFetch<PrivacyRequest>(`/requests/${requestId}`),
        privacyFetch<{ items: PrivacyHold[] }>(`/requests/${requestId}/holds`),
      ]);
      setDetail(request);
      setHolds(holdList.items);
      setHoldContext((current) =>
        request.contexts.some((context) => context.context_key === current)
          ? current
          : (request.contexts[0]?.context_key ?? ""),
      );
    } catch (cause) {
      setError(errorMessage(cause));
      setDetail(null);
      setHolds([]);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setDetail(null);
      setHolds([]);
    }
  }, [loadDetail, selectedId]);

  async function refreshCurrent(next?: PrivacyRequest) {
    await loadOverview();
    const requestId = next?.request_id ?? detail?.request_id;
    if (requestId) {
      setSelectedId(requestId);
      await loadDetail(requestId);
    }
  }

  async function runRequest(path: string, payload: Record<string, unknown>) {
    setWorking(true);
    setError(null);
    try {
      const next = await privacyFetch<PrivacyRequest>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refreshCurrent(next);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function verifyRequest() {
    if (!detail) return;
    await runRequest(`/requests/${detail.request_id}/verify`, {
      idempotency_key: commandKey("privacy-verify"),
      expected_version: detail.version,
    });
  }

  async function transitionContext(context: PrivacyContext, state: PrivacyContextState) {
    if (!detail) return;
    await runRequest(`/requests/${detail.request_id}/contexts/${context.context_key}`, {
      idempotency_key: commandKey(`privacy-context-${state}`),
      expected_version: context.version,
      state,
      internal_error_code: state === "failed" ? failureCode : null,
    });
  }

  async function generateExport() {
    if (!detail) return;
    setWorking(true);
    setError(null);
    try {
      await privacyFetch(`/requests/${detail.request_id}/generate-export`, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: commandKey("privacy-export"),
          expected_context_versions: contextVersions(detail),
        }),
      });
      await refreshCurrent();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function executePrivateDeletion() {
    if (!detail) return;
    await runRequest(`/requests/${detail.request_id}/execute-private-deletion`, {
      idempotency_key: commandKey("privacy-private-deletion"),
      expected_context_versions: contextVersions(detail, PRIVATE_DELETION_CONTEXTS),
    });
  }

  async function finalizeDeletion() {
    if (!detail) return;
    await runRequest(`/requests/${detail.request_id}/finalize-account-deletion`, {
      idempotency_key: commandKey("privacy-final-deletion"),
      expected_context_versions: contextVersions(detail, FINAL_DELETION_CONTEXTS),
    });
  }

  async function createHold() {
    if (!detail || !holdContext || !holdDue) return;
    const context = detail.contexts.find((item) => item.context_key === holdContext);
    if (!context) return;
    setWorking(true);
    setError(null);
    try {
      await privacyFetch(`/requests/${detail.request_id}/holds/${holdContext}`, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: commandKey("privacy-hold"),
          expected_context_version: context.version,
          basis: holdBasis,
          review_due_at: new Date(holdDue).toISOString(),
        }),
      });
      await refreshCurrent();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function releaseHold(hold: PrivacyHold) {
    if (!detail) return;
    const context = detail.contexts.find((item) => item.context_key === hold.context_key);
    if (!context) return;
    setWorking(true);
    setError(null);
    try {
      await privacyFetch(`/holds/${hold.hold_id}/release`, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: commandKey("privacy-hold-release"),
          expected_hold_version: hold.version,
          expected_context_version: context.version,
          reason: "basis_resolved",
        }),
      });
      await refreshCurrent();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function runMaintenance(replayAfterRestore: boolean) {
    if (replayAfterRestore && restoreConfirmation !== "REAPPLY") {
      setError("恢复后重放需要输入 REAPPLY。常规定时清理不会触发账户级重删。");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const result = await privacyFetch<MaintenanceResult>("/maintenance", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: commandKey("privacy-maintenance"),
          replay_tombstones_after_restore: replayAfterRestore,
          tombstone_account_limit: 100,
          max_scan_attempts: 3,
        }),
      });
      setMaintenanceResult(result);
      setRestoreConfirmation("");
      await loadOverview();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6" aria-labelledby="privacy-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">Privacy Operations</p>
          <h1 id="privacy-heading" className="mt-1 text-3xl font-bold text-stone-950">
            隐私请求工作台
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-700">
            请求、Hold、导出、删除、恢复后 tombstone 重放与指标均由 FastAPI/PostgreSQL 重新校验。这里不提供通用 CRUD，也不会显示导出密文、认证材料或原邮箱。
          </p>
        </div>
        <Button variant="outline" disabled={loading || working} onClick={() => void loadOverview()}>
          刷新队列与指标
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">
          {error}
        </p>
      ) : null}

      {metrics ? (
        <section className="mt-6" aria-labelledby="privacy-metrics-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="privacy-metrics-heading" className="text-xl font-bold text-stone-950">
              运行指标
            </h2>
            <p className="text-sm text-stone-700">
              最老开放请求：{formatAge(metrics.oldest_open_request_age_seconds)}
            </p>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="开放请求" value={metrics.open_request_count} />
            <MetricCard label="失败 Context" value={metrics.failed_context_count} />
            <MetricCard label="孤儿附件" value={metrics.orphan_attachment_count} />
            <MetricCard label="逾期 Hold" value={metrics.overdue_hold_review_count} />
            <MetricCard label="过期导出载荷" value={metrics.expired_export_payload_count} />
            <MetricCard label="35 天 Tombstone 账户" value={metrics.tombstone_account_count} />
            <MetricCard label="24h Tombstone 重放" value={metrics.tombstone_replay_count_24h} />
            <MetricCard label="24h 导出访问授权" value={metrics.export_access_grant_count_24h} />
            <MetricCard label="24h 导出下载" value={metrics.export_download_count_24h} />
            <MetricCard label="24h 已完成请求" value={metrics.completed_request_count_24h} />
          </dl>
          {metrics.alerts.length ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Privacy alerts">
              {metrics.alerts.map((alert) => (
                <li key={alert} className="rounded-md border border-amber-700 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {alert}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-stone-700">当前没有 Privacy 告警。</p>
          )}
        </section>
      ) : null}

      <section className="mt-8 rounded-xl border border-stone-300 bg-stone-50 p-5" aria-labelledby="maintenance-heading">
        <h2 id="maintenance-heading" className="text-xl font-bold text-stone-950">
          保留维护与恢复重放
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">
          常规维护清除过期导出密文、执行社区保留规则并最小化过期通知正文。只有确认发生备份恢复后，才运行账户级 tombstone 重放。
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Button disabled={working} onClick={() => void runMaintenance(false)}>
            运行常规保留维护
          </Button>
          <label className="grid gap-1 text-sm font-semibold text-stone-800">
            恢复确认词
            <input
              className="min-h-11 rounded-md border border-stone-400 bg-white px-3 font-mono"
              value={restoreConfirmation}
              onChange={(event) => setRestoreConfirmation(event.target.value)}
              placeholder="REAPPLY"
              autoComplete="off"
            />
          </label>
          <Button
            variant="outline"
            disabled={working || restoreConfirmation !== "REAPPLY"}
            onClick={() => void runMaintenance(true)}
          >
            备份恢复后重新应用删除
          </Button>
        </div>
        {maintenanceResult ? (
          <div className="mt-4 rounded-lg border border-stone-300 bg-white p-4 text-sm text-stone-800">
            <p className="font-semibold">最近运行：{maintenanceResult.run_id}</p>
            <p className="mt-1">完成时间：{formatDate(maintenanceResult.completed_at)}</p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(maintenanceResult.counts).map(([key, value]) => (
                <div key={key}>
                  <dt className="font-mono text-xs text-stone-600">{key}</dt>
                  <dd className="font-semibold text-stone-950">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </section>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Privacy request states">
        {REQUEST_STATES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-current={stateFilter === item.value ? "page" : undefined}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold ${
              stateFilter === item.value
                ? "border-stone-950 bg-stone-950 text-white"
                : "border-stone-300 bg-white text-stone-900"
            }`}
            onClick={() => setStateFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,2.15fr)]">
        <section className="rounded-xl border border-stone-300 bg-white p-4" aria-labelledby="privacy-queue-heading">
          <h2 id="privacy-queue-heading" className="text-lg font-bold text-stone-950">
            请求队列 ({filteredItems.length})
          </h2>
          {loading ? <p className="mt-4 text-sm text-stone-700">正在读取…</p> : null}
          <ul className="mt-4 grid gap-2">
            {filteredItems.map((item) => (
              <li key={item.request_id}>
                <button
                  type="button"
                  className={`w-full rounded-lg border p-3 text-left ${
                    selectedId === item.request_id
                      ? "border-stone-950 bg-stone-100"
                      : "border-stone-300 bg-white"
                  }`}
                  onClick={() => setSelectedId(item.request_id)}
                >
                  <span className="block font-semibold text-stone-950">
                    {item.kind === "account_deletion" ? "账号删除" : "访问导出"}
                  </span>
                  <span className="mt-1 block text-xs text-stone-600">{item.state}</span>
                  <span className="mt-1 block break-all font-mono text-xs text-stone-600">
                    {item.request_id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="privacy-detail-heading">
          <h2 id="privacy-detail-heading" className="text-xl font-bold text-stone-950">
            请求详情
          </h2>
          {!detail ? <p className="mt-4 text-sm text-stone-700">选择一个请求查看。</p> : null}
          {detail ? (
            <div className="mt-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-stone-700">Request ID</dt>
                  <dd className="mt-1 break-all font-mono text-stone-950">{detail.request_id}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-700">Account tombstone key</dt>
                  <dd className="mt-1 break-all font-mono text-stone-950">{detail.account_id}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-700">类型 / 状态</dt>
                  <dd className="mt-1 text-stone-950">{detail.kind} / {detail.state}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-700">请求时间</dt>
                  <dd className="mt-1 text-stone-950">{formatDate(detail.requested_at)}</dd>
                </div>
              </dl>
              <p className="mt-4 rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-800">
                {detail.requested_reason}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {detail.state === "requested" ? (
                  <Button disabled={working} onClick={() => void verifyRequest()}>
                    验证请求
                  </Button>
                ) : null}
                {detail.kind === "access_export" && ["verified", "processing"].includes(detail.state) ? (
                  <Button disabled={working} onClick={() => void generateExport()}>
                    生成加密导出
                  </Button>
                ) : null}
                {detail.kind === "account_deletion" && ["verified", "processing"].includes(detail.state) ? (
                  <>
                    <Button disabled={working} onClick={() => void executePrivateDeletion()}>
                      执行三个私有域删除
                    </Button>
                    <Button variant="outline" disabled={working} onClick={() => void finalizeDeletion()}>
                      最终 Archive / Identity 删除
                    </Button>
                  </>
                ) : null}
              </div>

              <section className="mt-7 border-t border-stone-200 pt-5" aria-labelledby="contexts-heading">
                <h3 id="contexts-heading" className="text-lg font-bold text-stone-950">
                  Context 状态
                </h3>
                <label className="mt-3 grid max-w-md gap-1 text-sm font-semibold text-stone-800">
                  失败代码
                  <input
                    className="min-h-11 rounded-md border border-stone-400 px-3 font-mono"
                    value={failureCode}
                    onChange={(event) => setFailureCode(event.target.value)}
                  />
                </label>
                <ul className="mt-4 grid gap-3">
                  {detail.contexts.map((context) => (
                    <li key={context.context_key} className="rounded-lg border border-stone-300 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm font-semibold text-stone-950">{context.context_key}</p>
                          <p className="mt-1 text-sm text-stone-700">
                            {context.state} · 尝试 {context.attempts} · v{context.version}
                          </p>
                          {context.last_error_code ? (
                            <p className="mt-1 font-mono text-xs text-red-800">{context.last_error_code}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {context.state === "pending" || context.state === "failed" ? (
                            <Button
                              variant="outline"
                              disabled={working}
                              onClick={() => void transitionContext(context, "processing")}
                            >
                              {context.state === "failed" ? "重试" : "开始"}
                            </Button>
                          ) : null}
                          {context.state === "pending" ? (
                            <Button
                              variant="outline"
                              disabled={working}
                              onClick={() => void transitionContext(context, "not_applicable")}
                            >
                              标记不适用
                            </Button>
                          ) : null}
                          {context.state === "processing" ? (
                            <Button
                              variant="outline"
                              disabled={working || failureCode.length < 3}
                              onClick={() => void transitionContext(context, "failed")}
                            >
                              记录失败
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-7 border-t border-stone-200 pt-5" aria-labelledby="holds-heading">
                <h3 id="holds-heading" className="text-lg font-bold text-stone-950">
                  Narrow Holds
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm font-semibold text-stone-800">
                    Context
                    <select
                      className="min-h-11 rounded-md border border-stone-400 bg-white px-3"
                      value={holdContext}
                      onChange={(event) => setHoldContext(event.target.value)}
                    >
                      {detail.contexts.map((context) => (
                        <option key={context.context_key} value={context.context_key}>
                          {context.context_key}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-stone-800">
                    Basis
                    <select
                      className="min-h-11 rounded-md border border-stone-400 bg-white px-3"
                      value={holdBasis}
                      onChange={(event) => setHoldBasis(event.target.value as PrivacyHold["basis"])}
                    >
                      <option value="legal_obligation">legal_obligation</option>
                      <option value="security_investigation">security_investigation</option>
                      <option value="fraud_prevention">fraud_prevention</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-stone-800">
                    Review due
                    <input
                      type="datetime-local"
                      className="min-h-11 rounded-md border border-stone-400 px-3"
                      value={holdDue}
                      onChange={(event) => setHoldDue(event.target.value)}
                    />
                  </label>
                </div>
                <Button className="mt-3" disabled={working || !holdDue} onClick={() => void createHold()}>
                  创建窄范围 Hold
                </Button>
                <ul className="mt-4 grid gap-3">
                  {holds.map((hold) => (
                    <li key={hold.hold_id} className="rounded-lg border border-stone-300 p-4 text-sm">
                      <p className="font-semibold text-stone-950">{hold.context_key} · {hold.basis}</p>
                      <p className="mt-1 text-stone-700">
                        {hold.state} · 复核 {formatDate(hold.review_due_at)}
                      </p>
                      {hold.state === "active" ? (
                        <Button
                          className="mt-3"
                          variant="outline"
                          disabled={working}
                          onClick={() => void releaseHold(hold)}
                        >
                          解除 Hold（basis resolved）
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
