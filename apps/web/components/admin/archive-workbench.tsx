"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type QueueName =
  | "all"
  | "ordinary_ready"
  | "sensitive_ready"
  | "publish_failed"
  | "projection_lag"
  | "targeted_correction"
  | "retraction"
  | "rollback"
  | "merge"
  | "split"
  | "emergency_followup";

type WorkbenchItem = {
  item_type: "change_set" | "release" | "operation";
  item_id: string;
  queue: string;
  title: string;
  status: string;
  risk_level: "ordinary" | "sensitive";
  version: number;
  base_archive_version: string | null;
  release_id: string | null;
  operation_id: string | null;
  created_at: string;
  updated_at: string;
};

type WorkbenchDetail = {
  item: WorkbenchItem;
  current_archive_version: string;
  current_public_version: string;
  change_set_id: string | null;
  governance_mode: string | null;
  validation_state: string | null;
  validation_hash: string | null;
  validation_issues: Array<Record<string, unknown>>;
  structured_diff: Array<Record<string, unknown>>;
  source_evidence: Array<Record<string, unknown>>;
  attachment_evidence: Array<Record<string, unknown>>;
  release_notes: string | null;
  public_impact: Record<string, unknown>;
  operation_effect: Record<string, unknown>;
  operation_subject: Record<string, unknown> | null;
  actor_roles: string[];
  actor_capabilities: string[];
  emergency_followup_due_at: string | null;
  emergency_followup_change_set_id: string | null;
};

type Metrics = {
  ordinary_ready: number;
  sensitive_ready: number;
  publish_failed: number;
  projection_lag: number;
  emergency_followup: number;
  cutover_state: "open" | "held";
  cutover_version: number;
};

type RehearsalSnapshot = {
  generated_at: string;
  old_state_counts: Record<string, number>;
  accountable_state_counts: Record<string, number>;
  release_counts: Record<string, number>;
  orphan_counts: Record<string, number>;
  historical_audit_count: number;
  archive_pointer_release_id: string | null;
  public_pointer_release_id: string | null;
  canonical_sha256: string;
  go: boolean;
  blockers: string[];
};

type AdminSession = {
  capabilities: string[];
  recent_auth: boolean;
};

const QUEUES: Array<{ value: QueueName; label: string }> = [
  { value: "ordinary_ready", label: "普通待发布" },
  { value: "sensitive_ready", label: "敏感待发布" },
  { value: "publish_failed", label: "发布失败" },
  { value: "projection_lag", label: "投影滞后" },
  { value: "targeted_correction", label: "定向修正" },
  { value: "retraction", label: "撤回" },
  { value: "rollback", label: "回滚" },
  { value: "merge", label: "合并" },
  { value: "split", label: "拆分" },
  { value: "emergency_followup", label: "紧急跟进" },
  { value: "all", label: "全部" },
];

function commandKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function errorText(value: unknown): string {
  return value instanceof Error ? value.message : "Archive 工作台操作失败。";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | T
    | { detail?: string | { code?: string; message?: string } }
    | null;
  if (response.ok) return body as T;
  const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
  if (typeof detail === "string") throw new Error(detail);
  if (detail && typeof detail === "object") {
    throw new Error(detail.message ?? detail.code ?? `Archive 服务返回 ${response.status}`);
  }
  throw new Error(`Archive 服务返回 ${response.status}`);
}

async function archiveFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse<T>(
    await fetch(`/api/admin/archive${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    }),
  );
}

function JsonBlock({ value }: Readonly<{ value: unknown }>) {
  return (
    <pre
      className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-stone-300 bg-stone-50 p-3 text-xs leading-5 text-stone-950"
      tabIndex={0}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}>) {
  const className =
    "mt-1 min-h-11 w-full rounded-md border border-stone-400 bg-white px-3 py-2 text-sm text-stone-950";
  return (
    <label className="block text-sm font-semibold text-stone-800">
      {label}
      {multiline ? (
        <textarea className={`${className} min-h-24`} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

export function ArchiveWorkbench() {
  const [queue, setQueue] = useState<QueueName>("ordinary_ready");
  const [items, setItems] = useState<WorkbenchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkbenchDetail | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [snapshot, setSnapshot] = useState<RehearsalSnapshot | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("Reviewed complete evidence and public impact in the Archive workbench.");
  const [dataVersion, setDataVersion] = useState("");
  const [riskLevel, setRiskLevel] = useState<"ordinary" | "sensitive">("ordinary");
  const [rollbackTargetId, setRollbackTargetId] = useState("");
  const [subjectType, setSubjectType] = useState("panda");
  const [subjectId, setSubjectId] = useState("");
  const [correctionAction, setCorrectionAction] = useState<"targeted_correction" | "retraction">("targeted_correction");
  const [effectJson, setEffectJson] = useState('{"fields":[]}');
  const [activitySourceId, setActivitySourceId] = useState("");
  const [activityTitleZh, setActivityTitleZh] = useState("资料已修正");
  const [activitySummaryZh, setActivitySummaryZh] = useState("已依据核实来源修正公开资料。");
  const [activityTitleEn, setActivityTitleEn] = useState("Profile corrected");
  const [activitySummaryEn, setActivitySummaryEn] = useState("The public profile was corrected from verified sources.");
  const [cutoverReason, setCutoverReason] = useState("Hold publication for an accountable governance migration rehearsal.");

  const canManageCutover = session?.capabilities.includes("archive.cutover.manage") ?? false;
  const hasRecentAuth = session?.recent_auth ?? false;

  const loadSummary = useCallback(async () => {
    const [metricResult, snapshotResult, sessionResult] = await Promise.all([
      archiveFetch<Metrics>("/workbench/metrics"),
      archiveFetch<RehearsalSnapshot>("/workbench/rehearsal-snapshot"),
      parseResponse<AdminSession>(
        await fetch("/api/admin/session", {
          credentials: "same-origin",
          cache: "no-store",
        }),
      ),
    ]);
    setMetrics(metricResult);
    setSnapshot(snapshotResult);
    setSession(sessionResult);
  }, []);

  const loadQueue = useCallback(async (nextQueue: QueueName) => {
    setLoading(true);
    setError(null);
    try {
      const result = await archiveFetch<{ items: WorkbenchItem[]; total: number }>(
        `/workbench?queue=${encodeURIComponent(nextQueue)}&limit=200`,
      );
      setItems(result.items);
      setSelectedId((current) =>
        current && result.items.some((item) => item.item_id === current)
          ? current
          : (result.items[0]?.item_id ?? null),
      );
    } catch (cause) {
      setError(errorText(cause));
      setItems([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (itemId: string) => {
    setError(null);
    try {
      const result = await archiveFetch<WorkbenchDetail>(`/workbench/items/${itemId}`);
      setDetail(result);
      setRiskLevel(result.item.risk_level);
      setSubjectId((current) => current || String(result.operation_subject?.entity_id ?? ""));
    } catch (cause) {
      setError(errorText(cause));
      setDetail(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadQueue(queue), loadSummary()]);
  }, [loadQueue, loadSummary, queue]);

  useEffect(() => {
    void refresh().catch((cause) => setError(errorText(cause)));
  }, [refresh]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [loadDetail, selectedId]);

  const queueCounts = useMemo(
    () => ({
      ordinary_ready: metrics?.ordinary_ready ?? 0,
      sensitive_ready: metrics?.sensitive_ready ?? 0,
      publish_failed: metrics?.publish_failed ?? 0,
      projection_lag: metrics?.projection_lag ?? 0,
      emergency_followup: metrics?.emergency_followup ?? 0,
    }),
    [metrics],
  );

  async function runCommand<T>(path: string, payload: Record<string, unknown>): Promise<T | null> {
    setWorking(true);
    setError(null);
    try {
      const result = await archiveFetch<T>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refresh();
      if (selectedId) await loadDetail(selectedId);
      return result;
    } catch (cause) {
      setError(errorText(cause));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function validateChangeSet() {
    if (!detail?.change_set_id) return;
    await runCommand(`/change-sets/${detail.change_set_id}/validate`, {
      expected_version: detail.item.version,
      idempotency_key: commandKey("archive-validate"),
      base_archive_version: detail.current_archive_version,
      reason,
      risk_level: riskLevel,
      correlation_id: crypto.randomUUID(),
    });
  }

  async function publishChangeSet() {
    if (!detail?.change_set_id || !dataVersion.trim()) return;
    await runCommand(`/change-sets/${detail.change_set_id}/publish`, {
      expected_version: detail.item.version,
      idempotency_key: commandKey("archive-publish"),
      reason,
      data_version: dataVersion.trim(),
      correlation_id: crypto.randomUUID(),
    });
  }

  async function rollbackRelease() {
    if (!snapshot?.archive_pointer_release_id || !rollbackTargetId.trim() || !dataVersion.trim()) return;
    await runCommand("/operations/rollback", {
      expected_archive_release_id: snapshot.archive_pointer_release_id,
      target_release_id: rollbackTargetId.trim(),
      idempotency_key: commandKey("archive-rollback"),
      reason,
      data_version: dataVersion.trim(),
      risk_level: riskLevel,
      correlation_id: crypto.randomUUID(),
      complex_rollback: snapshot.public_pointer_release_id !== rollbackTargetId.trim(),
    });
  }

  async function correctOrRetract() {
    if (!snapshot?.archive_pointer_release_id || !subjectId.trim() || !activitySourceId.trim() || !dataVersion.trim()) return;
    let effect: Record<string, unknown>;
    try {
      effect = JSON.parse(effectJson) as Record<string, unknown>;
    } catch {
      setError("Effect payload 必须是有效 JSON object。");
      return;
    }
    const retraction = correctionAction === "retraction";
    await runCommand("/operations/corrections", {
      expected_archive_release_id: snapshot.archive_pointer_release_id,
      idempotency_key: commandKey("archive-correction"),
      reason,
      data_version: dataVersion.trim(),
      risk_level: riskLevel,
      correlation_id: crypto.randomUUID(),
      operation_type: correctionAction,
      subject: { entity_type: subjectType.trim(), entity_id: subjectId.trim() },
      effect_payload: effect,
      impact_preview: {
        activity_count: 1,
        public_urls: [],
        warnings: [],
      },
      notification_eligible: true,
      activity_descriptor: {
        source_id: activitySourceId.trim(),
        action: retraction ? "retraction" : "correction",
        activity_type: retraction ? "archive.profile.retracted" : "archive.profile.corrected",
        targets: [{ target_type: subjectType === "institution" ? "institution" : "panda", target_id: subjectId.trim() }],
        notification_eligible: true,
        occurred_at: new Date().toISOString(),
        localization_key: retraction ? "archive.profile.retracted" : "archive.profile.corrected",
        localization_version: 1,
        localized_snapshots: [
          { locale: "zh-CN", title: activityTitleZh, summary: activitySummaryZh },
          { locale: "en", title: activityTitleEn, summary: activitySummaryEn },
        ],
        retraction_reason: retraction ? reason : null,
      },
    });
  }

  async function changeCutover(nextState: "open" | "held") {
    if (!metrics) return;
    await runCommand("/workbench/cutover", {
      expected_version: metrics.cutover_version,
      state: nextState,
      idempotency_key: commandKey(`cutover-${nextState}`),
      reason: cutoverReason,
      correlation_id: crypto.randomUUID(),
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 [&_*]:min-w-0" aria-labelledby="archive-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">Trusted Archive</p>
          <h1 id="archive-heading" className="mt-1 text-3xl font-bold text-stone-950">
            Archive 发布与迁移工作台
          </h1>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-stone-700">
            这里只展示完整证据并调用领域专用命令。Change Set、Release、回滚、合并/拆分和紧急下架均不提供通用 CRUD。
          </p>
        </div>
        <Button variant="outline" disabled={loading || working} onClick={() => void refresh()}>
          刷新工作台
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">
          {error}
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Archive 工作台指标">
        {[
          ["普通待发布", metrics?.ordinary_ready ?? 0],
          ["敏感待发布", metrics?.sensitive_ready ?? 0],
          ["发布失败", metrics?.publish_failed ?? 0],
          ["投影滞后", metrics?.projection_lag ?? 0],
          ["紧急跟进", metrics?.emergency_followup ?? 0],
          ["Cutover", metrics?.cutover_state ?? "unknown"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-stone-300 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">{label}</p>
            <p className="mt-2 text-2xl font-bold text-stone-950">{value}</p>
          </div>
        ))}
      </section>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Archive 队列">
        {QUEUES.map((entry) => {
          const count = entry.value in queueCounts ? queueCounts[entry.value as keyof typeof queueCounts] : undefined;
          return (
            <button
              key={entry.value}
              type="button"
              aria-current={queue === entry.value ? "page" : undefined}
              className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold ${
                queue === entry.value
                  ? "border-stone-950 bg-stone-950 text-white"
                  : "border-stone-300 bg-white text-stone-900"
              }`}
              onClick={() => setQueue(entry.value)}
            >
              {entry.label}{count === undefined ? "" : ` (${count})`}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,2.25fr)]">
        <section className="min-w-0 rounded-xl border border-stone-300 bg-white" aria-labelledby="archive-queue-heading">
          <h2 id="archive-queue-heading" className="border-b border-stone-200 px-4 py-3 text-lg font-bold text-stone-950">
            队列（{items.length}）
          </h2>
          {loading ? <p className="p-4 text-sm text-stone-700">正在读取…</p> : null}
          {!loading && items.length === 0 ? <p className="p-4 text-sm text-stone-700">当前队列为空。</p> : null}
          <ul className="max-h-[70vh] overflow-auto">
            {items.map((item) => (
              <li key={item.item_id} className="border-t border-stone-200 first:border-t-0">
                <button
                  type="button"
                  className={`w-full px-4 py-4 text-left ${selectedId === item.item_id ? "bg-stone-100" : "bg-white"}`}
                  onClick={() => setSelectedId(item.item_id)}
                >
                  <span className="block font-semibold text-stone-950">{item.title}</span>
                  <span className="mt-1 block text-xs text-stone-600">
                    {item.queue} · {item.status} · {item.risk_level}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="archive-detail-heading">
          <h2 id="archive-detail-heading" className="text-xl font-bold text-stone-950">
            完整证据与显式命令
          </h2>
          {!detail ? <p className="mt-4 text-sm text-stone-700">选择一个项目查看证据。</p> : null}
          {detail ? (
            <div className="mt-5 grid gap-6">
              <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div><dt className="font-semibold text-stone-700">Archive 版本</dt><dd className="mt-1 break-all">{detail.current_archive_version}</dd></div>
                <div><dt className="font-semibold text-stone-700">公开版本</dt><dd className="mt-1 break-all">{detail.current_public_version}</dd></div>
                <div><dt className="font-semibold text-stone-700">风险</dt><dd className="mt-1">{detail.item.risk_level}</dd></div>
                <div><dt className="font-semibold text-stone-700">状态 / 版本</dt><dd className="mt-1">{detail.item.status} / {detail.item.version}</dd></div>
              </dl>

              <div className="grid gap-4 xl:grid-cols-2">
                <section><h3 className="font-bold text-stone-950">结构化 Diff</h3><div className="mt-2"><JsonBlock value={detail.structured_diff} /></div></section>
                <section><h3 className="font-bold text-stone-950">验证问题</h3><div className="mt-2"><JsonBlock value={detail.validation_issues} /></div></section>
                <section><h3 className="font-bold text-stone-950">来源证据</h3><div className="mt-2"><JsonBlock value={detail.source_evidence} /></div></section>
                <section><h3 className="font-bold text-stone-950">附件与媒体权利</h3><div className="mt-2"><JsonBlock value={detail.attachment_evidence} /></div></section>
                <section><h3 className="font-bold text-stone-950">公开影响</h3><div className="mt-2"><JsonBlock value={detail.public_impact} /></div></section>
                <section><h3 className="font-bold text-stone-950">操作效果</h3><div className="mt-2"><JsonBlock value={detail.operation_effect} /></div></section>
              </div>

              <section className="rounded-lg border border-stone-300 p-4">
                <h3 className="text-lg font-bold text-stone-950">验证与发布</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="原因" value={reason} onChange={setReason} multiline />
                  <div className="grid gap-4">
                    <label className="block text-sm font-semibold text-stone-800">
                      风险分类
                      <select className="mt-1 min-h-11 w-full rounded-md border border-stone-400 bg-white px-3" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as "ordinary" | "sensitive")}>
                        <option value="ordinary">ordinary</option>
                        <option value="sensitive">sensitive</option>
                      </select>
                    </label>
                    <Field label="新 data_version" value={dataVersion} onChange={setDataVersion} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button disabled={working || !detail.change_set_id} onClick={() => void validateChangeSet()}>显式验证</Button>
                  <Button disabled={working || !detail.change_set_id || !dataVersion.trim()} onClick={() => void publishChangeSet()}>显式发布</Button>
                </div>
              </section>

              <section className="rounded-lg border border-stone-300 p-4">
                <h3 className="text-lg font-bold text-stone-950">安全回滚</h3>
                <p className="mt-2 text-sm text-stone-700">回滚总是创建新的不可变 Release，不移动历史记录。</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="目标 Release ID" value={rollbackTargetId} onChange={setRollbackTargetId} />
                  <Field label="新 data_version" value={dataVersion} onChange={setDataVersion} />
                </div>
                <Button className="mt-4" disabled={working || !rollbackTargetId.trim() || !dataVersion.trim()} onClick={() => void rollbackRelease()}>
                  创建回滚 Release
                </Button>
              </section>

              <section className="rounded-lg border border-stone-300 p-4">
                <h3 className="text-lg font-bold text-stone-950">定向修正 / 撤回</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-stone-800">操作<select className="mt-1 min-h-11 w-full rounded-md border border-stone-400 bg-white px-3" value={correctionAction} onChange={(event) => setCorrectionAction(event.target.value as "targeted_correction" | "retraction")}><option value="targeted_correction">targeted_correction</option><option value="retraction">retraction</option></select></label>
                  <Field label="Entity type" value={subjectType} onChange={setSubjectType} />
                  <Field label="Entity ID" value={subjectId} onChange={setSubjectId} />
                  <Field label="Activity source ID" value={activitySourceId} onChange={setActivitySourceId} />
                  <Field label="Effect payload JSON" value={effectJson} onChange={setEffectJson} multiline />
                  <div className="grid gap-3"><Field label="中文标题" value={activityTitleZh} onChange={setActivityTitleZh} /><Field label="中文摘要" value={activitySummaryZh} onChange={setActivitySummaryZh} multiline /></div>
                  <div className="grid gap-3"><Field label="English title" value={activityTitleEn} onChange={setActivityTitleEn} /><Field label="English summary" value={activitySummaryEn} onChange={setActivitySummaryEn} multiline /></div>
                </div>
                <Button className="mt-4" disabled={working || !subjectId.trim() || !activitySourceId.trim() || !dataVersion.trim()} onClick={() => void correctOrRetract()}>
                  创建修正 / 撤回 Release
                </Button>
              </section>
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="cutover-heading">
        <h2 id="cutover-heading" className="text-xl font-bold text-stone-950">迁移 rehearsal 与 Cutover</h2>
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          <div>
            <p className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${snapshot?.go ? "bg-emerald-100 text-emerald-950" : "bg-amber-100 text-amber-950"}`}>
              {snapshot?.go ? "GO" : "NO-GO"}
            </p>
            <dl className="mt-4 grid gap-2 text-sm">
              <div><dt className="font-semibold text-stone-700">Canonical SHA-256</dt><dd className="mt-1 break-all font-mono">{snapshot?.canonical_sha256 ?? "未加载"}</dd></div>
              <div><dt className="font-semibold text-stone-700">历史审计数</dt><dd className="mt-1">{snapshot?.historical_audit_count ?? 0}</dd></div>
              <div><dt className="font-semibold text-stone-700">Archive / Public 指针</dt><dd className="mt-1 break-all">{snapshot?.archive_pointer_release_id ?? "none"} / {snapshot?.public_pointer_release_id ?? "none"}</dd></div>
            </dl>
            <div className="mt-3"><JsonBlock value={{ old: snapshot?.old_state_counts, accountable: snapshot?.accountable_state_counts, releases: snapshot?.release_counts, orphans: snapshot?.orphan_counts, blockers: snapshot?.blockers }} /></div>
          </div>
          <div>
            <p className="text-sm leading-6 text-stone-700">Hold 会在数据库 trigger 层阻止任何新 publication batch；读取、已有 Release、Outbox 与 Public Projection 保持可用。</p>
            {!hasRecentAuth ? <p className="mt-3 rounded-md border border-amber-700 bg-amber-50 p-3 text-sm text-amber-950" role="alert">Cutover 变更需要 15 分钟内重新认证。</p> : null}
            <div className="mt-4"><Field label="Cutover 原因" value={cutoverReason} onChange={setCutoverReason} multiline /></div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button disabled={working || !canManageCutover || !hasRecentAuth || metrics?.cutover_state === "held"} onClick={() => void changeCutover("held")}>Hold 新发布</Button>
              <Button variant="outline" disabled={working || !canManageCutover || !hasRecentAuth || metrics?.cutover_state === "open"} onClick={() => void changeCutover("open")}>Resume 新发布</Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
