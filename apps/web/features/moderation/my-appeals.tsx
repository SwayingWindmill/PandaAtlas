"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PublicLocale } from "@/foundation/content/locales";

type ModerationAction = {
  action_id: string;
  kind: string;
  scope: string;
  reason_code: string;
  user_visible_explanation: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  effective: boolean;
  appeal_case_id: string | null;
};

type MyModeration = {
  account_state: "active" | "suspended" | "deleting" | "deleted";
  actions: ModerationAction[];
};

type Appeal = {
  appeal_case_id: string;
  sanction_action_id: string;
  state: "open" | "under_review" | "closed";
  version: number;
  appellant_message: string;
  first_response_due_at: string;
  first_responded_at: string | null;
  outcome: "upheld" | "modified" | "overturned" | null;
  user_visible_resolution: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  sanction_kind: string;
  sanction_scope: string;
  sanction_user_visible_explanation: string;
};

type AppealQueue = { items: Appeal[] };

const copy = {
  zh: {
    eyebrow: "账号与申诉",
    title: "我的限制与申诉",
    intro:
      "这里仅显示与你的账号相关的用户可见说明。工作人员内部说明、审计记录和其他账号信息不会出现在此页面。",
    state: "账号状态",
    restrictions: "限制记录",
    appeals: "申诉记录",
    noRestrictions: "当前没有限制记录。",
    noAppeals: "当前没有申诉记录。",
    active: "当前生效",
    inactive: "已结束或已恢复",
    appeal: "提交申诉",
    alreadyAppealed: "已提交申诉",
    appealMessage: "说明需要复核的事实",
    appealHint: "请说明发生了什么、哪些事实可能有误，以及希望工作人员复核的具体内容。",
    submit: "提交申诉",
    submitting: "正在提交…",
    cancel: "取消",
    due: "首次响应目标",
    opened: "已提交",
    underReview: "处理中",
    closed: "已关闭",
    result: "处理结果",
    refresh: "刷新",
    loadError: "无法读取限制或申诉记录。",
    submitError: "无法提交申诉。",
    minMessage: "申诉说明至少需要 10 个字符。",
  },
  en: {
    eyebrow: "Account and appeals",
    title: "My restrictions and appeals",
    intro:
      "This page shows only explanations that are safe to share with your account. Internal staff notes, audit evidence, and other accounts are never displayed here.",
    state: "Account state",
    restrictions: "Restriction history",
    appeals: "Appeal history",
    noRestrictions: "There are no restriction records for this account.",
    noAppeals: "There are no appeals for this account.",
    active: "Currently active",
    inactive: "Ended or restored",
    appeal: "Submit an appeal",
    alreadyAppealed: "Appeal submitted",
    appealMessage: "Explain what should be reviewed",
    appealHint: "Describe what happened, which facts may be incorrect, and what you want staff to review.",
    submit: "Submit appeal",
    submitting: "Submitting…",
    cancel: "Cancel",
    due: "First-response target",
    opened: "Submitted",
    underReview: "Under review",
    closed: "Closed",
    result: "Decision",
    refresh: "Refresh",
    loadError: "Restrictions or appeals could not be loaded.",
    submitError: "The appeal could not be submitted.",
    minMessage: "The appeal explanation must contain at least 10 characters.",
  },
} as const;

function commandKey(): string {
  return `appeal-${crypto.randomUUID()}`;
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
    throw new Error(detail.message ?? detail.code ?? `Request failed with ${response.status}`);
  }
  throw new Error(`Request failed with ${response.status}`);
}

async function moderationFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return parseResponse<T>(
    await fetch(`/api/moderation${path}`, {
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

function formatDate(value: string, locale: PublicLocale): string {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function stateLabel(state: Appeal["state"], locale: PublicLocale): string {
  const t = copy[locale];
  if (state === "open") return t.opened;
  if (state === "under_review") return t.underReview;
  return t.closed;
}

export function MyAppeals({ locale }: Readonly<{ locale: PublicLocale }>) {
  const t = copy[locale];
  const [moderation, setModeration] = useState<MyModeration | null>(null);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [appealMessage, setAppealMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appealByAction = useMemo(
    () => new Map(appeals.map((appeal) => [appeal.sanction_action_id, appeal])),
    [appeals],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [actions, queue] = await Promise.all([
        moderationFetch<MyModeration>("/actions"),
        moderationFetch<AppealQueue>("/appeals"),
      ]);
      setModeration(actions);
      setAppeals(queue.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAppeal(actionId: string) {
    if (appealMessage.trim().length < 10) {
      setError(t.minMessage);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const appeal = await moderationFetch<Appeal>("/appeals", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: commandKey(),
          sanction_action_id: actionId,
          appellant_message: appealMessage.trim(),
        }),
      });
      setAppeals((items) => [appeal, ...items.filter((item) => item.appeal_case_id !== appeal.appeal_case_id)]);
      setSelectedActionId(null);
      setAppealMessage("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8" aria-labelledby="appeals-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-700">{t.eyebrow}</p>
          <h1 id="appeals-heading" className="mt-1 text-3xl font-bold text-stone-950">
            {t.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">{t.intro}</p>
        </div>
        <Button variant="outline" disabled={loading || submitting} onClick={() => void load()}>
          {t.refresh}
        </Button>
      </div>

      {moderation ? (
        <p className="mt-6 rounded-lg border border-stone-300 bg-white p-4 text-sm text-stone-800">
          <span className="font-semibold">{t.state}:</span> {moderation.account_state}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-stone-700" aria-busy="true">
          {t.refresh}…
        </p>
      ) : null}

      {!loading ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="restrictions-heading">
            <h2 id="restrictions-heading" className="text-xl font-bold text-stone-950">
              {t.restrictions}
            </h2>
            {moderation?.actions.length ? (
              <ul className="mt-4 grid gap-4">
                {moderation.actions.map((action) => {
                  const existingAppeal = appealByAction.get(action.action_id);
                  const isSelected = selectedActionId === action.action_id;
                  return (
                    <li key={action.action_id} className="rounded-xl border border-stone-300 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-stone-950">
                            {action.kind} · {action.scope}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-stone-700">
                            {action.user_visible_explanation}
                          </p>
                          <p className="mt-3 text-xs text-stone-600">
                            {formatDate(action.starts_at, locale)}
                            {action.ends_at ? ` – ${formatDate(action.ends_at, locale)}` : ""}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${action.effective ? "bg-amber-100 text-amber-950" : "bg-stone-100 text-stone-700"}`}>
                          {action.effective ? t.active : t.inactive}
                        </span>
                      </div>

                      {existingAppeal ? (
                        <p className="mt-4 text-sm font-semibold text-stone-700">
                          {t.alreadyAppealed}: {stateLabel(existingAppeal.state, locale)}
                        </p>
                      ) : isSelected ? (
                        <div className="mt-5 grid gap-3 border-t border-stone-200 pt-4">
                          <label className="text-sm font-semibold text-stone-800">
                            {t.appealMessage}
                            <textarea
                              value={appealMessage}
                              onChange={(event) => setAppealMessage(event.target.value)}
                              className="mt-1 min-h-32 w-full rounded-md border border-stone-400 p-3 font-normal"
                              aria-describedby={`appeal-hint-${action.action_id}`}
                            />
                          </label>
                          <p id={`appeal-hint-${action.action_id}`} className="text-xs leading-5 text-stone-600">
                            {t.appealHint}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button disabled={submitting} onClick={() => void submitAppeal(action.action_id)}>
                              {submitting ? t.submitting : t.submit}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={submitting}
                              onClick={() => {
                                setSelectedActionId(null);
                                setAppealMessage("");
                              }}
                            >
                              {t.cancel}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => setSelectedActionId(action.action_id)}
                        >
                          {t.appeal}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-stone-300 bg-white p-4 text-sm text-stone-700">
                {t.noRestrictions}
              </p>
            )}
          </section>

          <section aria-labelledby="appeal-history-heading">
            <h2 id="appeal-history-heading" className="text-xl font-bold text-stone-950">
              {t.appeals}
            </h2>
            {appeals.length ? (
              <ul className="mt-4 grid gap-4">
                {appeals.map((appeal) => (
                  <li key={appeal.appeal_case_id} className="rounded-xl border border-stone-300 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-stone-950">
                          {appeal.sanction_kind} · {appeal.sanction_scope}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-700">
                          {appeal.sanction_user_visible_explanation}
                        </p>
                      </div>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                        {stateLabel(appeal.state, locale)}
                      </span>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-sm leading-6 text-stone-800">
                      {appeal.appellant_message}
                    </p>
                    <dl className="mt-4 grid gap-2 text-xs text-stone-600">
                      <div>
                        <dt className="inline font-semibold">{t.opened}: </dt>
                        <dd className="inline">{formatDate(appeal.created_at, locale)}</dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold">{t.due}: </dt>
                        <dd className="inline">{formatDate(appeal.first_response_due_at, locale)}</dd>
                      </div>
                    </dl>
                    {appeal.user_visible_resolution ? (
                      <div className="mt-4 rounded-lg border border-stone-200 p-3">
                        <p className="text-sm font-bold text-stone-950">
                          {t.result}: {appeal.outcome}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-stone-700">
                          {appeal.user_visible_resolution}
                        </p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-lg border border-stone-300 bg-white p-4 text-sm text-stone-700">
                {t.noAppeals}
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
