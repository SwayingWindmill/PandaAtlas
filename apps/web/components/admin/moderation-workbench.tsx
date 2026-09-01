"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

type SanctionKind =
  | "warning"
  | "submission_restricted"
  | "attachment_restricted"
  | "notification_restricted"
  | "account_suspended"
  | "account_closed_for_abuse";

type SanctionScope = "account" | "submission" | "attachment" | "notification";

type Sanction = {
  sanction_id: string;
  kind: SanctionKind;
  scope: SanctionScope;
  reason_code: string;
  internal_explanation: string | null;
  user_visible_explanation: string;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  restored_at: string | null;
};

type Appeal = {
  appeal_case_id: string;
  account_id: string;
  sanction_id: string;
  state: "open" | "under_review" | "closed";
  version: number;
  user_statement: string;
  first_response_due_at: string;
  first_responded_at: string | null;
  sla_overdue: boolean;
  age_seconds: number;
  decision: {
    outcome: string;
    internal_explanation: string | null;
    user_visible_explanation: string;
  } | null;
};

type ModerationSubject = {
  account_id: string;
  version: number;
  account_state: string;
  submission_restricted: boolean;
  attachment_restricted: boolean;
  notification_restricted: boolean;
  account_suspended: boolean;
  account_closed_for_abuse: boolean;
  repeat_abuse_count: number;
  inconsistent_account_state: boolean;
  sanctions: Sanction[];
  appeals: Appeal[];
};

type ModerationMetrics = {
  active_sanctions: number;
  oldest_active_sanction_age_seconds: number;
  active_submission_restrictions: number;
  active_attachment_restrictions: number;
  active_notification_restrictions: number;
  suspended_accounts: number;
  open_appeals: number;
  appeal_sla_overdue: number;
  oldest_appeal_age_seconds: number;
  repeat_abuse_accounts: number;
  expired_restriction_projected: number;
  restorations_last_24h: number;
  unauthorized_attempts_last_24h: number;
  inconsistent_account_state: number;
  alerts: string[];
};

const KIND_SCOPE: Record<SanctionKind, SanctionScope> = {
  warning: "account",
  submission_restricted: "submission",
  attachment_restricted: "attachment",
  notification_restricted: "notification",
  account_suspended: "account",
  account_closed_for_abuse: "account",
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/moderation/${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { detail?: string | { message?: string; code?: string } }
    | T
    | null;
  if (!response.ok) {
    const detail = body && typeof body === "object" && "detail" in body ? body.detail : null;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message ?? detail?.code ?? `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

function hoursToSeconds(value: number): number {
  return Math.max(0, Math.round(value * 60 * 60));
}

function ageLabel(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
  return `${Math.floor(seconds / 86400)} 天`;
}

function flagLabel(value: boolean): string {
  return value ? "是" : "否";
}

export function ModerationWorkbench() {
  const [metrics, setMetrics] = useState<ModerationMetrics | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [accountId, setAccountId] = useState("");
  const [subject, setSubject] = useState<ModerationSubject | null>(null);
  const [kind, setKind] = useState<SanctionKind>("warning");
  const [durationHours, setDurationHours] = useState(24);
  const [reasonCode, setReasonCode] = useState("policy_violation");
  const [internalExplanation, setInternalExplanation] = useState("");
  const [visibleExplanation, setVisibleExplanation] = useState("");
  const [restoreInternal, setRestoreInternal] = useState("");
  const [restoreVisible, setRestoreVisible] = useState("");
  const [appealInternal, setAppealInternal] = useState("");
  const [appealVisible, setAppealVisible] = useState("");
  const [appealOutcome, setAppealOutcome] = useState("upheld");
  const [appealSubjectVersion, setAppealSubjectVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshQueues = useCallback(async () => {
    const [nextMetrics, nextAppeals] = await Promise.all([
      requestJson<ModerationMetrics>("metrics"),
      requestJson<{ items: Appeal[] }>("appeals"),
    ]);
    setMetrics(nextMetrics);
    setAppeals(nextAppeals.items);
  }, []);

  useEffect(() => {
    void refreshQueues().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "无法读取 moderation 队列。");
    });
  }, [refreshQueues]);

  async function loadSubject(nextAccountId = accountId) {
    const normalized = nextAccountId.trim();
    if (!normalized) return;
    setBusy(true);
    setError(null);
    try {
      const nextSubject = await requestJson<ModerationSubject>(
        `accounts/${encodeURIComponent(normalized)}`,
      );
      setSubject(nextSubject);
      setAccountId(nextSubject.account_id);
      setAppealSubjectVersion(String(nextSubject.version));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取该账号。" );
    } finally {
      setBusy(false);
    }
  }

  async function submitSanction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const startsAt = new Date();
    const isIndefinite = kind === "warning" || kind === "account_closed_for_abuse";
    const endsAt = isIndefinite
      ? null
      : new Date(startsAt.getTime() + hoursToSeconds(durationHours) * 1000).toISOString();
    try {
      const nextSubject = await requestJson<ModerationSubject>(
        `accounts/${encodeURIComponent(subject.account_id)}/sanctions`,
        {
          method: "POST",
          body: JSON.stringify({
            idempotency_key: crypto.randomUUID(),
            expected_version: subject.version,
            kind,
            scope: KIND_SCOPE[kind],
            reason_code: reasonCode,
            internal_explanation: internalExplanation,
            user_visible_explanation: visibleExplanation,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt,
          }),
        },
      );
      setSubject(nextSubject);
      setAppealSubjectVersion(String(nextSubject.version));
      setNotice("处分已写入 append-only 记录，并更新当前 projection。");
      await refreshQueues();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "处分命令失败。" );
    } finally {
      setBusy(false);
    }
  }

  async function applyTemporaryFreeze() {
    if (!subject) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const startsAt = new Date();
    try {
      const nextSubject = await requestJson<ModerationSubject>(
        `accounts/${encodeURIComponent(subject.account_id)}/temporary-submission-freezes`,
        {
          method: "POST",
          body: JSON.stringify({
            idempotency_key: crypto.randomUUID(),
            expected_version: subject.version,
            scope: "submission",
            reason_code: reasonCode,
            internal_explanation: internalExplanation,
            user_visible_explanation: visibleExplanation,
            starts_at: startsAt.toISOString(),
            ends_at: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          }),
        },
      );
      setSubject(nextSubject);
      setAppealSubjectVersion(String(nextSubject.version));
      setNotice("24 小时 submission freeze 已写入。Reviewer 不能扩大 scope 或时长。");
      await refreshQueues();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "临时 freeze 命令失败。" );
    } finally {
      setBusy(false);
    }
  }

  async function restoreSanction(sanction: Sanction) {
    if (!subject) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const nextSubject = await requestJson<ModerationSubject>(
        `accounts/${encodeURIComponent(subject.account_id)}/sanctions/${encodeURIComponent(sanction.sanction_id)}/restore`,
        {
          method: "POST",
          body: JSON.stringify({
            idempotency_key: crypto.randomUUID(),
            expected_version: subject.version,
            reason_code: "manual_restoration",
            internal_explanation: restoreInternal,
            user_visible_explanation: restoreVisible,
          }),
        },
      );
      setSubject(nextSubject);
      setAppealSubjectVersion(String(nextSubject.version));
      setNotice("恢复决定已追加。工作人员角色和邮件同意不会自动恢复。");
      await refreshQueues();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "恢复命令失败。" );
    } finally {
      setBusy(false);
    }
  }

  async function acknowledgeAppeal(appeal: Appeal) {
    setBusy(true);
    setError(null);
    try {
      await requestJson<Appeal>(`appeals/${appeal.appeal_case_id}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          expected_version: appeal.version,
          internal_note: appealInternal,
        }),
      });
      setNotice("申诉已确认接收，首次响应 SLA 已记录。");
      await refreshQueues();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "确认申诉失败。" );
    } finally {
      setBusy(false);
    }
  }

  async function decideAppeal(appeal: Appeal) {
    setBusy(true);
    setError(null);
    try {
      await requestJson<Appeal>(`appeals/${appeal.appeal_case_id}/decide`, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          expected_version: appeal.version,
          outcome: appealOutcome,
          expected_subject_version:
            appealOutcome === "overturned" ? Number(appealSubjectVersion) : null,
          internal_explanation: appealInternal,
          user_visible_explanation: appealVisible,
        }),
      });
      setNotice("申诉决定已追加；overturned 时恢复与决定在同一事务完成。");
      await refreshQueues();
      if (subject?.account_id === appeal.account_id) await loadSubject(appeal.account_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "申诉决定失败。" );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">Scoped Moderation</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">账号处分与申诉工作台</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            这里只暴露版本化领域命令。Administrator、Archive Editor 和通用 React-admin CRUD
            不会获得 moderation 权限。
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-950"
        >
          返回控制台
        </Link>
      </div>

      {error ? <p className="mt-5 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">{error}</p> : null}
      {notice ? <p className="mt-5 rounded-lg border border-emerald-800 bg-emerald-50 p-4 text-sm text-emerald-950" role="status">{notice}</p> : null}

      {metrics ? (
        <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="moderation-metrics-heading">
          <h2 id="moderation-metrics-heading" className="text-xl font-bold text-stone-950">运行指标与告警</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="font-semibold text-stone-700">活动处分</dt><dd>{metrics.active_sanctions}</dd></div>
            <div><dt className="font-semibold text-stone-700">最老活动处分</dt><dd>{ageLabel(metrics.oldest_active_sanction_age_seconds)}</dd></div>
            <div><dt className="font-semibold text-stone-700">开放申诉</dt><dd>{metrics.open_appeals}</dd></div>
            <div><dt className="font-semibold text-stone-700">申诉 SLA 逾期</dt><dd>{metrics.appeal_sla_overdue}</dd></div>
            <div><dt className="font-semibold text-stone-700">恢复（24h）</dt><dd>{metrics.restorations_last_24h}</dd></div>
            <div><dt className="font-semibold text-stone-700">未授权尝试（24h）</dt><dd>{metrics.unauthorized_attempts_last_24h}</dd></div>
            <div><dt className="font-semibold text-stone-700">过期 projection</dt><dd>{metrics.expired_restriction_projected}</dd></div>
            <div><dt className="font-semibold text-stone-700">状态不一致</dt><dd>{metrics.inconsistent_account_state}</dd></div>
          </dl>
          {metrics.alerts.length ? <p className="mt-4 text-sm font-semibold text-red-900" role="alert">告警：{metrics.alerts.join("、")}</p> : null}
        </section>
      ) : null}

      <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="moderation-account-heading">
        <h2 id="moderation-account-heading" className="text-xl font-bold text-stone-950">账号与当前 projection</h2>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void loadSubject(); }}>
          <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold text-stone-800">
            Account UUID
            <input className="min-h-11 rounded-md border border-stone-400 px-3 font-mono font-normal" value={accountId} onChange={(event) => setAccountId(event.target.value)} required />
          </label>
          <Button type="submit" disabled={busy}>读取账号</Button>
        </form>
        {subject ? (
          <div className="mt-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="font-semibold text-stone-700">版本</dt><dd>{subject.version}</dd></div>
              <div><dt className="font-semibold text-stone-700">Identity 状态</dt><dd>{subject.account_state}</dd></div>
              <div><dt className="font-semibold text-stone-700">Submission restricted</dt><dd>{flagLabel(subject.submission_restricted)}</dd></div>
              <div><dt className="font-semibold text-stone-700">Attachment restricted</dt><dd>{flagLabel(subject.attachment_restricted)}</dd></div>
              <div><dt className="font-semibold text-stone-700">Notification restricted</dt><dd>{flagLabel(subject.notification_restricted)}</dd></div>
              <div><dt className="font-semibold text-stone-700">Suspended</dt><dd>{flagLabel(subject.account_suspended)}</dd></div>
              <div><dt className="font-semibold text-stone-700">Closed for abuse</dt><dd>{flagLabel(subject.account_closed_for_abuse)}</dd></div>
              <div><dt className="font-semibold text-stone-700">重复滥用次数</dt><dd>{subject.repeat_abuse_count}</dd></div>
            </dl>
            {subject.inconsistent_account_state ? <p className="mt-4 font-semibold text-red-900" role="alert">Identity 状态与 moderation projection 不一致。</p> : null}
          </div>
        ) : null}
      </section>

      {subject ? (
        <form className="mt-8 grid gap-4 rounded-xl border border-stone-300 bg-white p-5" onSubmit={(event) => void submitSanction(event)} aria-labelledby="sanction-command-heading">
          <h2 id="sanction-command-heading" className="text-xl font-bold text-stone-950">显式处分命令</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-stone-800">类型<select className="min-h-11 rounded-md border border-stone-400 px-3 font-normal" value={kind} onChange={(event) => setKind(event.target.value as SanctionKind)}>{Object.keys(KIND_SCOPE).map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold text-stone-800">时长（小时；warning/abuse closure 忽略）<input type="number" min={1} max={8760} className="min-h-11 rounded-md border border-stone-400 px-3 font-normal" value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} /></label>
            <label className="grid gap-1 text-sm font-semibold text-stone-800">Reason code<input className="min-h-11 rounded-md border border-stone-400 px-3 font-mono font-normal" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} required /></label>
          </div>
          <label className="grid gap-1 text-sm font-semibold text-stone-800">内部说明<textarea className="min-h-28 rounded-md border border-stone-400 p-3 font-normal" value={internalExplanation} onChange={(event) => setInternalExplanation(event.target.value)} minLength={10} required /></label>
          <label className="grid gap-1 text-sm font-semibold text-stone-800">用户可见说明<textarea className="min-h-28 rounded-md border border-stone-400 p-3 font-normal" value={visibleExplanation} onChange={(event) => setVisibleExplanation(event.target.value)} minLength={10} required /></label>
          <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>执行 Moderator 处分</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void applyTemporaryFreeze()}>执行 Reviewer 24h freeze</Button></div>
        </form>
      ) : null}

      {subject?.sanctions.length ? (
        <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="sanction-history-heading">
          <h2 id="sanction-history-heading" className="text-xl font-bold text-stone-950">Append-only 处分历史</h2>
          <div className="mt-4 grid gap-3"><label className="grid gap-1 text-sm font-semibold text-stone-800">恢复内部说明<textarea className="min-h-24 rounded-md border border-stone-400 p-3 font-normal" value={restoreInternal} onChange={(event) => setRestoreInternal(event.target.value)} minLength={10} /></label><label className="grid gap-1 text-sm font-semibold text-stone-800">恢复用户可见说明<textarea className="min-h-24 rounded-md border border-stone-400 p-3 font-normal" value={restoreVisible} onChange={(event) => setRestoreVisible(event.target.value)} minLength={10} /></label></div>
          <ul className="mt-5 grid gap-4">{subject.sanctions.map((sanction) => <li key={sanction.sanction_id} className="rounded-lg border border-stone-300 p-4"><p className="font-semibold text-stone-950">{sanction.kind} · {sanction.scope} · {sanction.active ? "active" : "inactive"}</p><p className="mt-2 text-sm text-stone-700">{sanction.user_visible_explanation}</p><p className="mt-2 break-all font-mono text-xs text-stone-600">{sanction.sanction_id}</p>{sanction.active ? <Button className="mt-3" variant="outline" disabled={busy || restoreInternal.length < 10 || restoreVisible.length < 10} onClick={() => void restoreSanction(sanction)}>追加恢复决定</Button> : null}</li>)}</ul>
        </section>
      ) : null}

      <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5" aria-labelledby="appeal-queue-heading">
        <h2 id="appeal-queue-heading" className="text-xl font-bold text-stone-950">申诉队列</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold text-stone-800">内部处理说明<textarea className="min-h-24 rounded-md border border-stone-400 p-3 font-normal" value={appealInternal} onChange={(event) => setAppealInternal(event.target.value)} minLength={10} /></label><label className="grid gap-1 text-sm font-semibold text-stone-800">用户可见决定说明<textarea className="min-h-24 rounded-md border border-stone-400 p-3 font-normal" value={appealVisible} onChange={(event) => setAppealVisible(event.target.value)} minLength={10} /></label><label className="grid gap-1 text-sm font-semibold text-stone-800">结果<select className="min-h-11 rounded-md border border-stone-400 px-3 font-normal" value={appealOutcome} onChange={(event) => setAppealOutcome(event.target.value)}><option value="upheld">upheld</option><option value="overturned">overturned</option><option value="dismissed">dismissed</option></select></label><label className="grid gap-1 text-sm font-semibold text-stone-800">Overturn 的 subject version<input type="number" min={1} className="min-h-11 rounded-md border border-stone-400 px-3 font-normal" value={appealSubjectVersion} onChange={(event) => setAppealSubjectVersion(event.target.value)} /></label></div>
        <ul className="mt-5 grid gap-4">
          {appeals.map((appeal) => {
            const overdue = appeal.sla_overdue;
            return (
              <li
                key={appeal.appeal_case_id}
                className={`rounded-lg border p-4 ${overdue ? "border-red-700 bg-red-50" : "border-stone-300"}`}
              >
                <p className={`font-semibold ${overdue ? "text-red-950" : "text-stone-950"}`}>
                  {appeal.state} · {overdue ? "SLA OVERDUE" : `到期 ${new Date(appeal.first_response_due_at).toLocaleString()}`}
                </p>
                <p className={`mt-2 text-sm ${overdue ? "text-red-900" : "text-stone-700"}`}>{appeal.user_statement}</p>
                <p className={`mt-2 break-all font-mono text-xs ${overdue ? "text-red-800" : "text-stone-600"}`}>
                  account {appeal.account_id} · appeal {appeal.appeal_case_id}
                </p>
                {appeal.state !== "closed" ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button variant="outline" disabled={busy || appealInternal.length < 10} onClick={() => void acknowledgeAppeal(appeal)}>确认接收</Button>
                    <Button disabled={busy || appealInternal.length < 10 || appealVisible.length < 10 || (appealOutcome === "overturned" && !appealSubjectVersion)} onClick={() => void decideAppeal(appeal)}>追加决定</Button>
                    <Button variant="outline" onClick={() => void loadSubject(appeal.account_id)}>读取申诉账号</Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
