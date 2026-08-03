"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type ModerationAction = {
  action_id: string;
  account_id: string;
  kind: string;
  scope: string;
  reason_code: string;
  internal_explanation: string;
  user_visible_explanation: string;
  starts_at: string;
  ends_at: string | null;
  resulting_version: number;
  supersedes_action_id: string | null;
  effective: boolean;
};

type AccountModeration = {
  account_id: string;
  version: number;
  account_state: string;
  actions: ModerationAction[];
};

type Appeal = {
  appeal_case_id: string;
  account_id: string;
  sanction_action_id: string;
  state: "open" | "under_review" | "closed";
  version: number;
  appellant_message: string;
  primary_assignee_id: string | null;
  first_response_due_at: string;
  first_responded_at: string | null;
  outcome: "upheld" | "modified" | "overturned" | null;
  user_visible_resolution: string | null;
  internal_resolution: string | null;
  sanction_kind: string;
  sanction_scope: string;
  sanction_user_visible_explanation: string;
  sla_overdue: boolean;
  queue_age_seconds: number;
};

type AppealQueue = { items: Appeal[]; state: string };

type Metrics = {
  active_sanctions: number;
  suspended_accounts: number;
  open_appeals: number;
  overdue_appeals: number;
  oldest_open_appeal_age_seconds: number;
};

function commandKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Moderation operation failed.";
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
    throw new Error(detail.message ?? detail.code ?? `Moderation service returned ${response.status}`);
  }
  throw new Error(`Moderation service returned ${response.status}`);
}

async function moderationFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse<T>(
    await fetch(`/api/admin/moderation${path}`, {
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

export function ModerationWorkbench() {
  const [accountId, setAccountId] = useState("");
  const [account, setAccount] = useState<AccountModeration | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState("warning");
  const [scope, setScope] = useState("account");
  const [reasonCode, setReasonCode] = useState("moderation.policy");
  const [internalExplanation, setInternalExplanation] = useState("");
  const [visibleExplanation, setVisibleExplanation] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [decision, setDecision] = useState("upheld");
  const [decisionReasonCode, setDecisionReasonCode] = useState("appeal.reviewed");
  const [decisionInternal, setDecisionInternal] = useState("");
  const [decisionVisible, setDecisionVisible] = useState("");

  const selectedAppeal = useMemo(
    () => appeals.find((appeal) => appeal.appeal_case_id === selectedAppealId) ?? null,
    [appeals, selectedAppealId],
  );

  const loadAppeals = useCallback(async () => {
    const [queue, currentMetrics] = await Promise.all([
      moderationFetch<AppealQueue>("/appeals?state=all&limit=100"),
      moderationFetch<Metrics>("/metrics"),
    ]);
    setAppeals(queue.items);
    setMetrics(currentMetrics);
    setSelectedAppealId((current) =>
      current && queue.items.some((item) => item.appeal_case_id === current)
        ? current
        : (queue.items.find((item) => item.state !== "closed")?.appeal_case_id ??
          queue.items[0]?.appeal_case_id ??
          null),
    );
  }, []);

  useEffect(() => {
    loadAppeals().catch((cause) => setError(message(cause)));
  }, [loadAppeals]);

  async function loadAccount() {
    if (!accountId.trim()) return;
    setWorking(true);
    setError(null);
    try {
      setAccount(await moderationFetch<AccountModeration>(`/accounts/${accountId.trim()}`));
    } catch (cause) {
      setError(message(cause));
      setAccount(null);
    } finally {
      setWorking(false);
    }
  }

  async function issueAction() {
    if (!account) return;
    setWorking(true);
    setError(null);
    try {
      const startsAt = new Date();
      const hours = Number(durationHours);
      const endsAt = Number.isFinite(hours) && hours > 0
        ? new Date(startsAt.getTime() + hours * 3_600_000).toISOString()
        : null;
      const result = await moderationFetch<AccountModeration>(
        `/accounts/${account.account_id}/actions`,
        {
          method: "POST",
          body: JSON.stringify({
            idempotency_key: commandKey("sanction"),
            expected_version: account.version,
            kind,
            scope,
            reason_code: reasonCode,
            internal_explanation: internalExplanation,
            user_visible_explanation: visibleExplanation,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt,
          }),
        },
      );
      setAccount(result);
      setInternalExplanation("");
      setVisibleExplanation("");
      await loadAppeals();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setWorking(false);
    }
  }

  async function restore(action: ModerationAction) {
    if (!account) return;
    setWorking(true);
    setError(null);
    try {
      setAccount(
        await moderationFetch<AccountModeration>(`/actions/${action.action_id}/restore`, {
          method: "POST",
          body: JSON.stringify({
            idempotency_key: commandKey("restore"),
            expected_version: account.version,
            reason_code: "moderation.restored",
            internal_explanation: "The action is no longer necessary after staff review.",
            user_visible_explanation: "This restriction has been removed after review.",
          }),
        }),
      );
      await loadAppeals();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setWorking(false);
    }
  }

  async function claimAppeal() {
    if (!selectedAppeal) return;
    setWorking(true);
    setError(null);
    try {
      const result = await moderationFetch<Appeal>(
        `/appeals/${selectedAppeal.appeal_case_id}/claim`,
        {
          method: "POST",
          body: JSON.stringify({
            idempotency_key: commandKey("appeal-claim"),
            expected_version: selectedAppeal.version,
          }),
        },
      );
      setAppeals((items) =>
        items.map((item) => (item.appeal_case_id === result.appeal_case_id ? result : item)),
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setWorking(false);
    }
  }

  async function decideAppeal() {
    if (!selectedAppeal) return;
    setWorking(true);
    setError(null);
    try {
      const result = await moderationFetch<Appeal>(
        `/appeals/${selectedAppeal.appeal_case_id}/decide`,
        {
          method: "POST",
          body: JSON.stringify({
            idempotency_key: commandKey("appeal-decision"),
            expected_version: selectedAppeal.version,
            outcome: decision,
            reason_code: decisionReasonCode,
            internal_resolution: decisionInternal,
            user_visible_resolution: decisionVisible,
            replacement_kind: null,
            replacement_scope: null,
            replacement_starts_at: null,
            replacement_ends_at: null,
          }),
        },
      );
      setAppeals((items) =>
        items.map((item) => (item.appeal_case_id === result.appeal_case_id ? result : item)),
      );
      setDecisionInternal("");
      setDecisionVisible("");
      await loadAppeals();
      if (account?.account_id === result.account_id) await loadAccount();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6" aria-labelledby="moderation-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">Review &amp; Moderation</p>
          <h1 id="moderation-heading" className="mt-1 text-3xl font-bold text-stone-950">
            制裁与申诉工作台
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-700">
            所有操作通过 FastAPI 命令执行，重新检查 Capability、最近认证、版本、冲突、审计和 Outbox。历史制裁与申诉决定不会被覆盖。
          </p>
        </div>
        <Button variant="outline" disabled={working} onClick={() => void loadAppeals()}>
          刷新
        </Button>
      </div>

      {metrics ? (
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["有效制裁", metrics.active_sanctions],
            ["暂停账号", metrics.suspended_accounts],
            ["开放申诉", metrics.open_appeals],
            ["逾期申诉", metrics.overdue_appeals],
            ["最老申诉", elapsed(metrics.oldest_open_appeal_age_seconds)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-stone-300 bg-white p-4">
              <dt className="text-sm font-semibold text-stone-700">{label}</dt>
              <dd className="mt-1 text-2xl font-bold text-stone-950">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="account-moderation-heading">
          <h2 id="account-moderation-heading" className="text-xl font-bold text-stone-950">
            账号制裁
          </h2>
          <div className="mt-4 flex gap-2">
            <label className="flex-1 text-sm font-semibold text-stone-800">
              Account ID
              <input
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3"
              />
            </label>
            <Button className="self-end" disabled={working || !accountId.trim()} onClick={() => void loadAccount()}>
              读取
            </Button>
          </div>

          {account ? (
            <div className="mt-5 grid gap-4">
              <p className="text-sm text-stone-700">
                状态 <strong>{account.account_state}</strong> · 版本 <strong>{account.version}</strong>
              </p>
              <div className="grid gap-3 rounded-lg border border-stone-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-stone-800">
                    类型
                    <select value={kind} onChange={(event) => setKind(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3">
                      <option value="warning">warning</option>
                      <option value="submission_restricted">submission_restricted</option>
                      <option value="attachment_restricted">attachment_restricted</option>
                      <option value="notification_restricted">notification_restricted</option>
                      <option value="account_suspended">account_suspended</option>
                      <option value="account_closed_for_abuse">account_closed_for_abuse</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-stone-800">
                    Scope
                    <input value={scope} onChange={(event) => setScope(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" />
                  </label>
                  <label className="text-sm font-semibold text-stone-800">
                    Reason code
                    <input value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" />
                  </label>
                  <label className="text-sm font-semibold text-stone-800">
                    时长（小时，留空为无期限）
                    <input inputMode="numeric" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" />
                  </label>
                </div>
                <label className="text-sm font-semibold text-stone-800">
                  内部说明
                  <textarea value={internalExplanation} onChange={(event) => setInternalExplanation(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-stone-400 p-3" />
                </label>
                <label className="text-sm font-semibold text-stone-800">
                  用户可见说明
                  <textarea value={visibleExplanation} onChange={(event) => setVisibleExplanation(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-stone-400 p-3" />
                </label>
                <Button disabled={working || internalExplanation.length < 3 || visibleExplanation.length < 10} onClick={() => void issueAction()}>
                  记录制裁
                </Button>
              </div>

              <ul className="grid gap-3">
                {account.actions.map((action) => (
                  <li key={action.action_id} className="rounded-lg border border-stone-300 p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-stone-950">{action.kind} · {action.scope}</p>
                        <p className="mt-1 text-stone-700">{action.user_visible_explanation}</p>
                        <p className="mt-2 font-mono text-xs text-stone-600">{action.action_id}</p>
                      </div>
                      {action.effective && action.kind !== "restoration" ? (
                        <Button variant="outline" disabled={working} onClick={() => void restore(action)}>
                          恢复
                        </Button>
                      ) : (
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">已失效</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="appeal-heading">
          <h2 id="appeal-heading" className="text-xl font-bold text-stone-950">申诉队列</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
            <ul className="grid content-start gap-2">
              {appeals.map((appeal) => (
                <li key={appeal.appeal_case_id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg border p-3 text-left text-sm ${selectedAppealId === appeal.appeal_case_id ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white text-stone-950"}`}
                    onClick={() => setSelectedAppealId(appeal.appeal_case_id)}
                  >
                    <span className="block font-bold">{appeal.sanction_kind}</span>
                    <span className="mt-1 block">{appeal.state}{appeal.sla_overdue ? " · SLA 逾期" : ""}</span>
                  </button>
                </li>
              ))}
            </ul>

            {selectedAppeal ? (
              <div className="rounded-lg border border-stone-200 p-4 text-sm">
                <p className="font-bold text-stone-950">{selectedAppeal.sanction_kind} · {selectedAppeal.sanction_scope}</p>
                <p className="mt-2 text-stone-700">{selectedAppeal.sanction_user_visible_explanation}</p>
                <h3 className="mt-4 font-bold text-stone-950">申诉内容</h3>
                <p className="mt-1 whitespace-pre-wrap text-stone-700">{selectedAppeal.appellant_message}</p>
                <p className="mt-3 text-xs text-stone-600">等待 {elapsed(selectedAppeal.queue_age_seconds)} · 版本 {selectedAppeal.version}</p>

                {selectedAppeal.state === "open" ? (
                  <Button className="mt-4" disabled={working} onClick={() => void claimAppeal()}>
                    领取申诉
                  </Button>
                ) : null}

                {selectedAppeal.state === "under_review" ? (
                  <div className="mt-5 grid gap-3 border-t border-stone-200 pt-4">
                    <label className="font-semibold text-stone-800">
                      结果
                      <select value={decision} onChange={(event) => setDecision(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3">
                        <option value="upheld">upheld</option>
                        <option value="overturned">overturned</option>
                      </select>
                    </label>
                    <label className="font-semibold text-stone-800">
                      Reason code
                      <input value={decisionReasonCode} onChange={(event) => setDecisionReasonCode(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3" />
                    </label>
                    <label className="font-semibold text-stone-800">
                      内部结论
                      <textarea value={decisionInternal} onChange={(event) => setDecisionInternal(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-stone-400 p-3" />
                    </label>
                    <label className="font-semibold text-stone-800">
                      用户可见结论
                      <textarea value={decisionVisible} onChange={(event) => setDecisionVisible(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-stone-400 p-3" />
                    </label>
                    <Button disabled={working || decisionInternal.length < 3 || decisionVisible.length < 10} onClick={() => void decideAppeal()}>
                      记录决定
                    </Button>
                  </div>
                ) : null}

                {selectedAppeal.state === "closed" ? (
                  <div className="mt-4 rounded-lg bg-stone-50 p-3">
                    <p className="font-bold text-stone-950">{selectedAppeal.outcome}</p>
                    <p className="mt-1 text-stone-700">{selectedAppeal.user_visible_resolution}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-stone-700">当前没有申诉。</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
