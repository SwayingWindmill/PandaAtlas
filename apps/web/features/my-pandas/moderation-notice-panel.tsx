"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PublicLocale } from "@/foundation/content/locales";

type Sanction = {
  sanction_id: string;
  kind: string;
  scope: string;
  user_visible_explanation: string;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
};

type Appeal = {
  appeal_case_id: string;
  sanction_id: string;
  state: "open" | "under_review" | "closed";
  user_statement: string;
  first_response_due_at: string;
  sla_overdue: boolean;
  decision: {
    outcome: string;
    user_visible_explanation: string;
  } | null;
};

type ModerationNotice = {
  version: number;
  account_state: string;
  submission_restricted: boolean;
  attachment_restricted: boolean;
  notification_restricted: boolean;
  account_suspended: boolean;
  account_closed_for_abuse: boolean;
  sanctions: Sanction[];
  appeals: Appeal[];
};

const copy = {
  zh: {
    heading: "账号状态与申诉",
    intro: "这里显示当前账号的用户可见处分说明。处分不会删除 Follow、熊猫护照、投稿历史或已公开的档案事实。",
    active: "当前有效处分",
    appeals: "申诉状态",
    noAppeal: "选择一项处分提交申诉。工作人员应在五个工作日内首次响应。",
    statement: "申诉说明",
    submit: "提交申诉",
    submitted: "申诉已提交。",
    unavailable: "暂时无法读取账号状态。",
    due: "首次响应截止",
    outcome: "决定",
  },
  en: {
    heading: "Account status and appeals",
    intro: "This shows the user-visible reasons for current sanctions. Sanctions do not delete Follow state, Panda Passport history, submissions, or published Archive facts.",
    active: "Current sanctions",
    appeals: "Appeal status",
    noAppeal: "Select a sanction to appeal. Staff should provide a first response within five business days.",
    statement: "Appeal statement",
    submit: "Submit appeal",
    submitted: "Appeal submitted.",
    unavailable: "Account status is temporarily unavailable.",
    due: "First response due",
    outcome: "Decision",
  },
} as const;

export function ModerationNoticePanel({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const [notice, setNotice] = useState<ModerationNotice | null>(null);
  const [selectedSanction, setSelectedSanction] = useState("");
  const [statement, setStatement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadNotice = useCallback(async () => {
    const response = await fetch("/api/moderation/notice", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 404) {
      setNotice(null);
      return;
    }
    if (!response.ok) throw new Error(t.unavailable);
    const nextNotice = (await response.json()) as ModerationNotice;
    setNotice(nextNotice);
    const appealed = new Set(
      nextNotice.appeals
        .filter((appeal) => appeal.state !== "closed")
        .map((appeal) => appeal.sanction_id),
    );
    const firstAppealable = nextNotice.sanctions.find(
      (sanction) => !appealed.has(sanction.sanction_id),
    );
    setSelectedSanction(firstAppealable?.sanction_id ?? "");
  }, [t.unavailable]);

  useEffect(() => {
    void loadNotice().catch(() => setError(t.unavailable));
  }, [loadNotice, t.unavailable]);

  const activeSanctions = useMemo(
    () => notice?.sanctions.filter((sanction) => sanction.active) ?? [],
    [notice],
  );
  const openAppealSanctions = useMemo(
    () => new Set(notice?.appeals.filter((appeal) => appeal.state !== "closed").map((appeal) => appeal.sanction_id) ?? []),
    [notice],
  );
  const appealableSanctions =
    notice?.sanctions.filter((sanction) => !openAppealSanctions.has(sanction.sanction_id)) ?? [];

  async function submitAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!notice || !selectedSanction) return;
    setBusy(true);
    setError(null);
    setConfirmation(null);
    try {
      const response = await fetch("/api/moderation/appeals", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          expected_version: notice.version,
          sanction_id: selectedSanction,
          user_statement: statement,
        }),
      });
      if (!response.ok) {
        // Stable empty parse fallback for an invalid moderation error payload; the failure remains visible.
        const body = (await response.json().catch(() => null)) as
          | { detail?: string | { message?: string; code?: string } }
          | null;
        const detail = body?.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : detail?.message ?? detail?.code ?? t.unavailable,
        );
      }
      setStatement("");
      setConfirmation(t.submitted);
      await loadNotice();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.unavailable);
    } finally {
      setBusy(false);
    }
  }

  if (!notice || (!notice.sanctions.length && !notice.appeals.length)) return null;

  return (
    <section
      className="mx-auto my-8 w-full max-w-6xl rounded-xl border border-amber-700 bg-amber-50 p-5"
      aria-labelledby="moderation-notice-heading"
    >
      <h2 id="moderation-notice-heading" className="text-xl font-bold text-stone-950">
        {t.heading}
      </h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-800">{t.intro}</p>
      <p className="mt-3 text-sm font-semibold text-stone-950">
        {notice.account_state}
        {notice.account_suspended ? " · suspended" : ""}
        {notice.account_closed_for_abuse ? " · closed for abuse" : ""}
      </p>

      {activeSanctions.length ? (
        <div className="mt-5">
          <h3 className="font-bold text-stone-950">{t.active}</h3>
          <ul className="mt-3 grid gap-3">
            {activeSanctions.map((sanction) => (
              <li key={sanction.sanction_id} className="rounded-lg border border-amber-800 bg-white p-4">
                <p className="font-semibold text-stone-950">
                  {sanction.kind} · {sanction.scope}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-800">
                  {sanction.user_visible_explanation}
                </p>
                {sanction.ends_at ? (
                  <p className="mt-2 text-xs text-stone-700">
                    {new Date(sanction.ends_at).toLocaleString(locale === "zh" ? "zh-CN" : "en")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice.appeals.length ? (
        <div className="mt-5">
          <h3 className="font-bold text-stone-950">{t.appeals}</h3>
          <ul className="mt-3 grid gap-3">
            {notice.appeals.map((appeal) => (
              <li key={appeal.appeal_case_id} className="rounded-lg border border-stone-400 bg-white p-4">
                <p className="font-semibold text-stone-950">
                  {appeal.state}
                  {appeal.sla_overdue ? " · SLA overdue" : ""}
                </p>
                <p className="mt-2 text-sm text-stone-800">{appeal.user_statement}</p>
                <p className="mt-2 text-xs text-stone-700">
                  {t.due}: {new Date(appeal.first_response_due_at).toLocaleString(locale === "zh" ? "zh-CN" : "en")}
                </p>
                {appeal.decision ? (
                  <p className="mt-2 text-sm text-stone-800">
                    {t.outcome}: {appeal.decision.outcome} — {appeal.decision.user_visible_explanation}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {appealableSanctions.length ? (
        <form className="mt-5 grid gap-3" onSubmit={(event) => void submitAppeal(event)}>
          <p className="text-sm text-stone-800">{t.noAppeal}</p>
          <label className="grid gap-1 text-sm font-semibold text-stone-900">
            {t.active}
            <select
              className="min-h-11 rounded-md border border-stone-500 bg-white px-3 font-normal"
              value={selectedSanction}
              onChange={(event) => setSelectedSanction(event.target.value)}
            >
              {appealableSanctions.map((sanction) => (
                <option key={sanction.sanction_id} value={sanction.sanction_id}>
                  {sanction.kind} · {sanction.scope}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-stone-900">
            {t.statement}
            <textarea
              className="min-h-32 rounded-md border border-stone-500 bg-white p-3 font-normal"
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              minLength={20}
              maxLength={4000}
              required
            />
          </label>
          <div>
            <Button type="submit" disabled={busy || statement.length < 20}>
              {t.submit}
            </Button>
          </div>
        </form>
      ) : null}

      {confirmation ? <p className="mt-4 text-sm font-semibold text-emerald-900" role="status">{confirmation}</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-red-900" role="alert">{error}</p> : null}
    </section>
  );
}
