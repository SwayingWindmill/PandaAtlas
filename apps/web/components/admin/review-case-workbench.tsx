"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type QueueName =
  | "all"
  | "new"
  | "triage"
  | "assigned"
  | "waiting"
  | "decision_ready"
  | "incorporation_recommended"
  | "closed"
  | "sla_overdue";

type ReviewSummary = {
  review_case_id: string;
  submission_id: string;
  target_type: string;
  target_id: string;
  state: string;
  version: number;
  active_revision_number: number;
  primary_assignee_id: string | null;
  risk_level: "normal" | "elevated" | "high";
  contributor_status: string;
  first_response_due_at: string;
  first_responded_at: string | null;
  sla_overdue: boolean;
  queue_age_seconds: number;
};

type ReviewSource = {
  source_id: string;
  title: string;
  locator: string;
  publisher: string | null;
  published_on: string | null;
  verification_outcome: "verified" | "rejected" | null;
  normalized_locator: string | null;
  canonical_source_id: string | null;
};

type ReviewAttachment = {
  attachment_id: string;
  original_filename: string;
  media_type: string;
  byte_size: number;
  state: string;
  clean_accessible: boolean;
};

type ReviewDecision = {
  decision_id: string;
  outcome: string;
  user_visible_explanation: string;
  selected_assertion_keys: string[];
};

type ReviewDetail = ReviewSummary & {
  contributor_account_id: string | null;
  sources: ReviewSource[];
  attachments: ReviewAttachment[];
  decisions: ReviewDecision[];
  information_requests: Array<{
    information_request_id: string;
    requested_fields: string[];
    user_visible_message: string;
    internal_note: string | null;
  }>;
};

type ActiveRevision = {
  revision_number: number;
  public_version_seen: string;
  content: Record<string, unknown>;
};

type AssertionView = {
  assertion_key: string;
  kind?: string;
  field_path?: string;
  proposed_value?: unknown;
  explanation?: string;
};

type EvidenceAccess = {
  reference: string;
  expires_at: string;
};

const QUEUES: Array<{ value: QueueName; label: string }> = [
  { value: "new", label: "新建" },
  { value: "triage", label: "分诊" },
  { value: "assigned", label: "已分配" },
  { value: "waiting", label: "等待补充" },
  { value: "decision_ready", label: "可决定" },
  { value: "incorporation_recommended", label: "已推荐收录" },
  { value: "sla_overdue", label: "SLA 逾期" },
  { value: "closed", label: "已关闭" },
  { value: "all", label: "全部" },
];

function commandKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : "审核操作失败。";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | { detail?: string | { code?: string; message?: string } }
    | T
    | null;
  if (response.ok) return body as T;
  const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
  if (typeof detail === "string") throw new Error(detail);
  if (detail && typeof detail === "object") {
    throw new Error(detail.message ?? detail.code ?? `审核服务返回 ${response.status}`);
  }
  throw new Error(`审核服务返回 ${response.status}`);
}

async function reviewFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse<T>(
    await fetch(`/api/admin/review-cases${path}`, {
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

function elapsed(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
  return `${Math.floor(seconds / 86400)} 天`;
}

function assertionsFromRevision(revision: ActiveRevision | null): AssertionView[] {
  const raw = revision?.content.assertions;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is AssertionView =>
      Boolean(item) &&
      typeof item === "object" &&
      "assertion_key" in item &&
      typeof item.assertion_key === "string",
  );
}

function Panel({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="mt-7 border-t border-stone-200 pt-5">
      <h3 className="text-lg font-bold text-stone-950">{title}</h3>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

export function ReviewCaseWorkbench() {
  const [queue, setQueue] = useState<QueueName>("new");
  const [items, setItems] = useState<ReviewSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [revision, setRevision] = useState<ActiveRevision | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riskLevel, setRiskLevel] = useState<ReviewSummary["risk_level"]>("normal");
  const [triageDuplicateId, setTriageDuplicateId] = useState("");
  const [triageNote, setTriageNote] = useState("");
  const [requestedFields, setRequestedFields] = useState("");
  const [visibleMessage, setVisibleMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState("accepted");
  const [decisionExplanation, setDecisionExplanation] = useState("");
  const [decisionInternalReason, setDecisionInternalReason] = useState("");
  const [decisionDuplicateId, setDecisionDuplicateId] = useState("");
  const [selectedAssertions, setSelectedAssertions] = useState<string[]>([]);
  const [evidenceExpiry, setEvidenceExpiry] = useState<Record<string, string>>({});

  const assertions = useMemo(() => assertionsFromRevision(revision), [revision]);

  const loadQueue = useCallback(async (nextQueue: QueueName) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reviewFetch<{ items: ReviewSummary[] }>(
        `?queue=${encodeURIComponent(nextQueue)}&limit=100`,
      );
      setItems(result.items);
      setSelectedId((current) =>
        current && result.items.some((item) => item.review_case_id === current)
          ? current
          : (result.items[0]?.review_case_id ?? null),
      );
    } catch (cause) {
      setError(errorMessage(cause));
      setItems([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (reviewCaseId: string) => {
    setError(null);
    try {
      const [caseResult, revisionResult] = await Promise.all([
        reviewFetch<ReviewDetail>(`/${reviewCaseId}`),
        reviewFetch<ActiveRevision>(`/${reviewCaseId}/active-revision`),
      ]);
      setDetail(caseResult);
      setRevision(revisionResult);
      setRiskLevel(caseResult.risk_level);
      setTriageDuplicateId("");
      setSelectedAssertions(caseResult.decisions.at(-1)?.selected_assertion_keys ?? []);
    } catch (cause) {
      setError(errorMessage(cause));
      setDetail(null);
      setRevision(null);
    }
  }, []);

  useEffect(() => {
    void loadQueue(queue);
  }, [loadQueue, queue]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setDetail(null);
      setRevision(null);
    }
  }, [loadDetail, selectedId]);

  async function run(path: string, payload: Record<string, unknown>) {
    if (!detail) return;
    setWorking(true);
    setError(null);
    try {
      const result = await reviewFetch<ReviewDetail>(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setDetail(result);
      await loadQueue(queue);
      await loadDetail(result.review_case_id);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function triage() {
    if (!detail) return;
    await run(`/${detail.review_case_id}/triage`, {
      idempotency_key: commandKey("triage"),
      expected_version: detail.version,
      risk_level: riskLevel,
      active_revision_number: detail.active_revision_number,
      duplicate_of_review_case_id: triageDuplicateId || null,
      internal_note: triageNote || null,
    });
  }

  async function claim() {
    if (!detail) return;
    await run(`/${detail.review_case_id}/claim`, {
      idempotency_key: commandKey("claim"),
      expected_version: detail.version,
    });
  }

  async function requestMoreInformation() {
    if (!detail) return;
    await run(`/${detail.review_case_id}/request-information`, {
      idempotency_key: commandKey("request"),
      expected_version: detail.version,
      requested_fields: requestedFields
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      user_visible_message: visibleMessage,
      internal_note: internalNote || null,
    });
    setRequestedFields("");
    setVisibleMessage("");
    setInternalNote("");
  }

  async function verifySource(source: ReviewSource, outcome: "verified" | "rejected") {
    if (!detail) return;
    await run(`/${detail.review_case_id}/sources/${source.source_id}/verify`, {
      idempotency_key: commandKey("verify-source"),
      expected_version: detail.version,
      outcome,
      normalized_locator: outcome === "verified" ? source.normalized_locator ?? source.locator : null,
      canonical_source_id: outcome === "verified" ? source.canonical_source_id : null,
      reason:
        outcome === "verified"
          ? "Reviewer verified the source identity, locator, and publication context."
          : "Reviewer could not verify the source identity or claimed publication context.",
    });
  }

  async function requestEvidenceAccess(attachment: ReviewAttachment) {
    if (!detail || !attachment.clean_accessible) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/review-evidence/${attachment.attachment_id}`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: `ReviewCase ${detail.review_case_id} evidence review`,
          preview: true,
        }),
      });
      const access = await parseResponse<EvidenceAccess>(response);
      setEvidenceExpiry((current) => ({
        ...current,
        [attachment.attachment_id]: access.expires_at,
      }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function decide() {
    if (!detail) return;
    await run(`/${detail.review_case_id}/decide`, {
      idempotency_key: commandKey("decision"),
      expected_version: detail.version,
      outcome: decisionOutcome,
      user_visible_explanation: decisionExplanation,
      internal_reason: decisionInternalReason || null,
      selected_assertion_keys: decisionOutcome === "accepted" ? selectedAssertions : [],
      duplicate_of_review_case_id:
        decisionOutcome === "duplicate" ? decisionDuplicateId || null : null,
    });
  }

  async function recommend() {
    if (!detail) return;
    await run(`/${detail.review_case_id}/recommend`, {
      idempotency_key: commandKey("recommend"),
      expected_version: detail.version,
      reason: "Selected accepted assertions are ready for Curation intake.",
    });
  }

  async function reopen() {
    if (!detail) return;
    await run(`/${detail.review_case_id}/reopen`, {
      idempotency_key: commandKey("reopen"),
      reason: "New evidence or correction requires a new append-only review record.",
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6" aria-labelledby="review-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">Review &amp; Moderation</p>
          <h1 id="review-heading" className="mt-1 text-3xl font-bold text-stone-950">
            贡献审核工作台
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-700">
            Submission、ReviewCase 与贡献者可见状态保持独立；命令在 FastAPI 中重新校验权限、冲突、版本和证据。
          </p>
        </div>
        <Button variant="outline" disabled={loading || working} onClick={() => void loadQueue(queue)}>
          刷新队列
        </Button>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="审核队列">
        {QUEUES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-current={queue === item.value ? "page" : undefined}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold ${
              queue === item.value
                ? "border-stone-950 bg-stone-950 text-white"
                : "border-stone-300 bg-white text-stone-900"
            }`}
            onClick={() => setQueue(item.value)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,2.2fr)]">
        <section className="rounded-xl border border-stone-300 bg-white" aria-labelledby="queue-heading">
          <h2 id="queue-heading" className="border-b border-stone-200 px-4 py-3 text-lg font-bold text-stone-950">
            队列（{items.length}）
          </h2>
          {loading ? <p className="p-4 text-sm text-stone-700">正在读取审核队列…</p> : null}
          {!loading && items.length === 0 ? (
            <p className="p-4 text-sm text-stone-700">当前队列没有 ReviewCase。</p>
          ) : null}
          <ul className="divide-y divide-stone-200">
            {items.map((item) => (
              <li key={item.review_case_id}>
                <button
                  type="button"
                  className={`w-full px-4 py-4 text-left ${
                    selectedId === item.review_case_id ? "bg-amber-50" : "bg-white hover:bg-stone-50"
                  }`}
                  onClick={() => setSelectedId(item.review_case_id)}
                >
                  <span className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-stone-950">{item.target_id}</strong>
                    <span className="text-xs font-semibold uppercase text-stone-600">{item.state}</span>
                  </span>
                  <span className="mt-2 block text-xs text-stone-700">
                    排队 {elapsed(item.queue_age_seconds)} · v{item.version}
                  </span>
                  {item.sla_overdue ? (
                    <span className="mt-2 inline-block rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-900">
                      首次响应 SLA 逾期
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="case-heading">
          {!detail ? <p className="text-sm text-stone-700">选择一个 ReviewCase 查看详情。</p> : null}
          {detail ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">{detail.state}</p>
                  <h2 id="case-heading" className="mt-1 text-2xl font-bold text-stone-950">
                    {detail.target_type}: {detail.target_id}
                  </h2>
                  <p className="mt-2 break-all font-mono text-xs text-stone-600">{detail.review_case_id}</p>
                </div>
                <Button disabled={working || detail.state === "closed"} onClick={() => void claim()}>
                  领取此案
                </Button>
              </div>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div><dt className="font-semibold text-stone-600">活动修订</dt><dd>#{detail.active_revision_number}</dd></div>
                <div><dt className="font-semibold text-stone-600">版本</dt><dd>{detail.version}</dd></div>
                <div><dt className="font-semibold text-stone-600">风险</dt><dd>{detail.risk_level}</dd></div>
                <div><dt className="font-semibold text-stone-600">贡献者状态</dt><dd>{detail.contributor_status}</dd></div>
              </dl>

              <Panel title="分诊与重复支持">
                <label className="text-sm font-semibold text-stone-800">
                  风险等级
                  <select className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as ReviewSummary["risk_level"])}>
                    <option value="normal">normal</option>
                    <option value="elevated">elevated</option>
                    <option value="high">high</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-stone-800">
                  可能重复的 ReviewCase ID（可空）
                  <input className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={triageDuplicateId} onChange={(event) => setTriageDuplicateId(event.target.value.trim())} />
                </label>
                <label className="text-sm font-semibold text-stone-800">
                  内部分诊备注
                  <textarea className="mt-1 min-h-20 w-full rounded-md border border-stone-400 p-3" value={triageNote} onChange={(event) => setTriageNote(event.target.value)} />
                </label>
                <Button variant="outline" disabled={working || detail.state === "closed"} onClick={() => void triage()}>
                  保存分诊
                </Button>
              </Panel>

              <Panel title="活动不可变修订">
                <p className="text-sm text-stone-700">贡献者看到的公开版本：{revision?.public_version_seen ?? "读取中"}</p>
                {assertions.map((assertion) => (
                  <label key={assertion.assertion_key} className="flex gap-3 rounded-lg border border-stone-300 p-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={selectedAssertions.includes(assertion.assertion_key)}
                      onChange={(event) =>
                        setSelectedAssertions((current) =>
                          event.target.checked
                            ? [...new Set([...current, assertion.assertion_key])]
                            : current.filter((key) => key !== assertion.assertion_key),
                        )
                      }
                    />
                    <span className="min-w-0 text-sm">
                      <strong className="font-mono text-stone-950">{assertion.assertion_key}</strong>
                      <span className="mt-1 block text-stone-700">{assertion.field_path ?? assertion.kind ?? "结构化断言"}</span>
                      <span className="mt-1 block break-words text-stone-950">{JSON.stringify(assertion.proposed_value)}</span>
                      {assertion.explanation ? <span className="mt-1 block text-stone-700">{assertion.explanation}</span> : null}
                    </span>
                  </label>
                ))}
              </Panel>

              <Panel title="来源验证">
                {detail.sources.map((source) => (
                  <article key={source.source_id} className="rounded-lg border border-stone-300 p-4">
                    <h4 className="font-bold text-stone-950">{source.title}</h4>
                    <p className="mt-1 break-all text-sm text-stone-700">{source.locator}</p>
                    <p className="mt-1 text-xs text-stone-600">{source.publisher ?? "未提供出版者"} · {source.published_on ?? "未提供日期"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" disabled={working || detail.state === "closed" || source.verification_outcome === "verified"} onClick={() => void verifySource(source, "verified")}>
                        {source.verification_outcome === "verified" ? "已验证" : "验证并规范化"}
                      </Button>
                      <Button variant="outline" disabled={working || detail.state === "closed" || source.verification_outcome === "rejected"} onClick={() => void verifySource(source, "rejected")}>
                        无法验证
                      </Button>
                    </div>
                  </article>
                ))}
              </Panel>

              <Panel title="私有附件">
                <p className="text-sm text-stone-700">只有 clean 附件可进入短时、审计访问流程；对象路径和签名引用不会显示在页面中。</p>
                {detail.attachments.map((attachment) => (
                  <article key={attachment.attachment_id} className="rounded-lg border border-stone-300 p-3 text-sm">
                    <p><strong>{attachment.original_filename}</strong> · {attachment.media_type} · {attachment.byte_size} bytes</p>
                    <p className={`mt-1 font-bold ${attachment.clean_accessible ? "text-green-800" : "text-red-800"}`}>
                      {attachment.clean_accessible ? "clean，可申请访问" : `${attachment.state}，不可访问`}
                    </p>
                    {attachment.clean_accessible ? (
                      <Button className="mt-3" variant="outline" disabled={working} onClick={() => void requestEvidenceAccess(attachment)}>
                        申请短时预览访问
                      </Button>
                    ) : null}
                    {evidenceExpiry[attachment.attachment_id] ? (
                      <p className="mt-2 text-xs text-stone-600">已记录敏感读取；访问引用到期时间：{evidenceExpiry[attachment.attachment_id]}</p>
                    ) : null}
                  </article>
                ))}
              </Panel>

              <Panel title="请求补充信息">
                <label className="text-sm font-semibold text-stone-800">
                  请求字段（逗号分隔）
                  <input className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={requestedFields} onChange={(event) => setRequestedFields(event.target.value)} />
                </label>
                <label className="text-sm font-semibold text-stone-800">
                  贡献者可见说明
                  <textarea className="mt-1 min-h-24 w-full rounded-md border border-stone-400 p-3" value={visibleMessage} onChange={(event) => setVisibleMessage(event.target.value)} />
                </label>
                <label className="text-sm font-semibold text-stone-800">
                  内部备注（永不投影给贡献者）
                  <textarea className="mt-1 min-h-20 w-full rounded-md border border-stone-400 p-3" value={internalNote} onChange={(event) => setInternalNote(event.target.value)} />
                </label>
                <Button disabled={working || !requestedFields.trim() || visibleMessage.trim().length < 10} onClick={() => void requestMoreInformation()}>
                  发送补充请求
                </Button>
              </Panel>

              <Panel title="追加审核决定">
                <label className="text-sm font-semibold text-stone-800">
                  结果
                  <select className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value)}>
                    <option value="accepted">accepted</option>
                    <option value="not_accepted">not accepted</option>
                    <option value="duplicate">duplicate</option>
                    <option value="out_of_scope">out of scope</option>
                    <option value="abuse">abuse</option>
                  </select>
                </label>
                {decisionOutcome === "duplicate" ? (
                  <label className="text-sm font-semibold text-stone-800">
                    重复的 ReviewCase ID
                    <input className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" value={decisionDuplicateId} onChange={(event) => setDecisionDuplicateId(event.target.value.trim())} />
                  </label>
                ) : null}
                <label className="text-sm font-semibold text-stone-800">
                  贡献者可见解释
                  <textarea className="mt-1 min-h-24 w-full rounded-md border border-stone-400 p-3" value={decisionExplanation} onChange={(event) => setDecisionExplanation(event.target.value)} />
                </label>
                <label className="text-sm font-semibold text-stone-800">
                  内部理由
                  <textarea className="mt-1 min-h-20 w-full rounded-md border border-stone-400 p-3" value={decisionInternalReason} onChange={(event) => setDecisionInternalReason(event.target.value)} />
                </label>
                <Button
                  disabled={
                    working ||
                    detail.state === "closed" ||
                    decisionExplanation.trim().length < 10 ||
                    (decisionOutcome === "accepted" && selectedAssertions.length === 0) ||
                    (decisionOutcome === "duplicate" && !decisionDuplicateId)
                  }
                  onClick={() => void decide()}
                >
                  记录不可变决定
                </Button>
              </Panel>

              <div className="mt-7 flex flex-wrap gap-3 border-t border-stone-200 pt-5">
                {detail.decisions.at(-1)?.outcome === "accepted" && detail.state === "decision_ready" ? (
                  <Button disabled={working} onClick={() => void recommend()}>推荐所选断言进入 Curation</Button>
                ) : null}
                {detail.state === "closed" ? (
                  <Button variant="outline" disabled={working} onClick={() => void reopen()}>创建新的重开记录</Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
