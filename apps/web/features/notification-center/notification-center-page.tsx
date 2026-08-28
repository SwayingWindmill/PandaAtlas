"use client";

import type { Route } from "next";
import Link from "next/link";
import { Bell, CheckCheck, CircleAlert, LockKeyhole, Mail, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import type { PublicLocale } from "@/foundation/content/locales";
import type {
  NotificationInboxData,
  NotificationMessageData,

  NotificationCategory,
  NotificationPreferenceData,
} from "@/features/notification-center/types";

interface NotificationCenterPageProps {
  locale: PublicLocale;

}

type LoadState = "loading" | "ready" | "signed-out" | "blocked" | "unavailable";

const optionalCategories: NotificationCategory[] = [
  "knowledge_update",
  "correction",



];

const copy = {
  zh: {
    eyebrow: "私有通知中心",
    title: "站内 Inbox 与邮件偏好",
    description: "站内通知、已读状态和邮件偏好仅属于当前账号。收藏熊猫不会自动开启邮件。",
    privacy: "此页面不会创建公开用户档案，也不会公开其他人的收藏。",
    loading: "正在读取通知…",
    signedOutTitle: "登录后查看通知",
    signedOutBody: "Inbox 和邮件偏好是私有账号数据。",
    signIn: "登录",
    blockedTitle: "账号当前无法读取通知",
    blockedBody: "账号被冻结、暂停或进入删除流程时，私有通知读取会停止。",
    unavailableTitle: "通知服务暂时不可用",
    unavailableBody: "站内通知数据库暂时无法响应；公开熊猫档案不受影响。",
    retry: "重试",
    inbox: "Inbox",
    unread: "未读",
    markAll: "全部标为已读",
    markRead: "标为已读",
    read: "已读",
    emptyTitle: "Inbox 还是空的",
    emptyBody: "经过审核且符合通知条件的动态会在这里出现。",
    retracted: "已撤回",
    earlier: "查看更早通知",
    preferences: "邮件偏好",
    preferencesBody: "邮件是可选通道。站内 Inbox 与收藏不会因关闭邮件而删除。",
    enabled: "已开启",
    disabled: "已关闭",
    enable: "开启邮件",
    disable: "关闭邮件",
    mandatory: "安全与角色通知属于强制类别，不能关闭。",
    saved: "偏好已保存",
    actionFailed: "操作未完成，请重试。",
    category: {
      knowledge_update: "生日动态",
      correction: "重要动态",
      submission_status: "提交状态",
      incorporation: "内容收录",
      correction_retraction: "更正与撤回",
      security_role: "安全与角色",
    },
    fallbackTitle: "吱熊猫通知",
    fallbackSummary: "打开通知中心查看最新状态。",
  },
  en: {
    eyebrow: "Private notification center",
    title: "Native Inbox and email preferences",
    description: "Inbox facts, read state, and email preferences belong only to the current account. Favoriting a panda never enables email automatically.",
    privacy: "This page does not create a public user profile or reveal anyone else's favorites.",
    loading: "Loading notifications…",
    signedOutTitle: "Sign in to view notifications",
    signedOutBody: "Inbox and email preferences are private account data.",
    signIn: "Sign in",
    blockedTitle: "This account cannot read notifications",
    blockedBody: "Private notification reads stop while an account is frozen, suspended, or being deleted.",
    unavailableTitle: "Notifications are temporarily unavailable",
    unavailableBody: "The native Inbox database could not respond. Public panda profiles are unaffected.",
    retry: "Retry",
    inbox: "Inbox",
    unread: "Unread",
    markAll: "Mark all as read",
    markRead: "Mark as read",
    read: "Read",
    emptyTitle: "Your Inbox is empty",
    emptyBody: "Reviewed, notification-eligible Activity will appear here.",
    retracted: "Retracted",
    earlier: "View earlier notifications",
    preferences: "Email preferences",
    preferencesBody: "Email is optional. Turning it off does not remove favorites or native Inbox facts.",
    enabled: "Enabled",
    disabled: "Disabled",
    enable: "Enable email",
    disable: "Disable email",
    mandatory: "Security and role notifications are mandatory and cannot be disabled.",
    saved: "Preference saved",
    actionFailed: "The action did not complete. Try again.",
    category: {
      knowledge_update: "Birthday Activity",
      correction: "Major Activity",
      submission_status: "Submission status",
      incorporation: "Contribution incorporation",
      correction_retraction: "Corrections and retractions",
      security_role: "Security and roles",
    },
    fallbackTitle: "ZhiPanda notification",
    fallbackSummary: "Open the notification center for the latest state.",
  },
} as const;

function localizedContent(
  item: NotificationMessageData,
  locale: PublicLocale,
  fallbackTitle: string,
  fallbackSummary: string,
): { title: string; summary: string } {
  const directTitle = item.content[locale === "zh" ? "title_zh" : "title_en"];
  const directSummary = item.content[locale === "zh" ? "summary_zh" : "summary_en"];
  if (typeof directTitle === "string" || typeof directSummary === "string") {
    return {
      title: typeof directTitle === "string" ? directTitle : fallbackTitle,
      summary: typeof directSummary === "string" ? directSummary : fallbackSummary,
    };
  }
  const snapshots = item.content.localized_snapshots;
  if (Array.isArray(snapshots)) {
    const wanted = locale === "zh" ? "zh-CN" : "en";
    const snapshot = snapshots.find((value) => {
      if (!value || typeof value !== "object") return false;
      return (value as Record<string, unknown>).locale === wanted;
    }) as Record<string, unknown> | undefined;
    return {
      title: typeof snapshot?.title === "string" ? snapshot.title : fallbackTitle,
      summary: typeof snapshot?.summary === "string" ? snapshot.summary : fallbackSummary,
    };
  }
  return { title: fallbackTitle, summary: fallbackSummary };
}

export function NotificationCenterPage({ locale }: NotificationCenterPageProps) {
  const t = copy[locale];
  const [state, setState] = useState<LoadState>("loading");
  const [page, setPage] = useState<NotificationInboxData | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferenceData[]>([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const alternate = locale === "zh" ? "en" : "zh";

  const load = useCallback(async (signal?: AbortSignal) => {
    const session = await fetch("/api/identity/session", { cache: "no-store", signal }).catch(() => null);
    if (!session) {
      setState("unavailable");
      return;
    }
    if (session.status === 401) {
      setState("signed-out");
      return;
    }
    if (!session.ok) {
      setState(session.status === 403 ? "blocked" : "unavailable");
      return;
    }

    const [inboxResponse, preferenceResponse] = await Promise.all([
      fetch("/api/notification/inbox", { cache: "no-store", signal }).catch(() => null),
      fetch("/api/notification/preferences", { cache: "no-store", signal }).catch(() => null),
    ]);
    if (!inboxResponse || !preferenceResponse) {
      setState("unavailable");
      return;
    }
    if (inboxResponse.status === 401 || preferenceResponse.status === 401) {
      setState("signed-out");
      return;
    }
    if (inboxResponse.status === 403 || preferenceResponse.status === 403) {
      setState("blocked");
      return;
    }
    if (!inboxResponse.ok || !preferenceResponse.ok) {
      setState("unavailable");
      return;
    }
    setPage(await inboxResponse.json() as NotificationInboxData);
    setPreferences(await preferenceResponse.json() as NotificationPreferenceData[]);
    setState("ready");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const emailPreferences = useMemo(() => new Map(
    preferences
      .filter((preference) => preference.channel === "email")
      .map((preference) => [preference.category, preference]),
  ), [preferences]);

  async function markRead(item: NotificationMessageData) {
    setBusyKey(item.messageId);
    setStatusMessage("");
    const response = await fetch(`/api/notification/inbox/${item.messageId}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },

    }).catch(() => null);
    if (!response?.ok) {
      setStatusMessage(t.actionFailed);
      setBusyKey(null);
      return;
    }
    const updated = await response.json() as NotificationMessageData;
    setPage((current) => current ? {
      ...current,
      unreadCount: Math.max(0, current.unreadCount - (item.readAt ? 0 : 1)),
      items: current.items.map((entry) => entry.messageId === item.messageId ? updated : entry),
    } : current);
    setStatusMessage(t.read);
    setBusyKey(null);
  }

  async function markAllRead() {
    setBusyKey("read-all");
    setStatusMessage("");
    const response = await fetch("/api/notification/inbox/read-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },

    }).catch(() => null);
    if (!response?.ok) {
      setStatusMessage(t.actionFailed);
      setBusyKey(null);
      return;
    }
    const now = new Date().toISOString();
    setPage((current) => current ? {
      ...current,
      unreadCount: 0,
      items: current.items.map((entry) => ({ ...entry, readAt: entry.readAt ?? now })),
    } : current);
    setStatusMessage(t.read);
    setBusyKey(null);
  }

  async function updatePreference(category: NotificationCategory, enabled: boolean) {
    setBusyKey(`preference:${category}`);
    setStatusMessage("");
    const response = await fetch("/api/notification/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        channel: "email",
        enabled,

      }),
    }).catch(() => null);
    if (!response?.ok) {
      setStatusMessage(t.actionFailed);
      setBusyKey(null);
      return;
    }
    const updated = await response.json() as NotificationPreferenceData;
    setPreferences((current) => [
      ...current.filter((preference) => !(preference.category === category && preference.channel === "email")),
      updated,
    ]);
    setStatusMessage(t.saved);
    setBusyKey(null);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <GlobalNavigation
        locale={locale}
        active="inbox"
        alternatePath={`/${alternate}/me/inbox`}
      />
      <main id="main-content" className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 md:px-8 md:pt-16">
        <section className="rounded-3xl border border-[var(--pa-color-accent-border-10)] bg-[var(--pa-color-accent-fill-04)] p-6 md:p-10">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            <LockKeyhole aria-hidden="true" className="size-4" />
            <span>{t.eyebrow}</span>
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-[var(--fg)] md:text-5xl">{t.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)]">{t.description}</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">{t.privacy}</p>
        </section>

        {state === "loading" ? (
          <p className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--muted)]" role="status">{t.loading}</p>
        ) : null}

        {state === "signed-out" ? (
          <section className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-2xl font-semibold text-[var(--fg)]">{t.signedOutTitle}</h2>
            <p className="mt-3 text-[var(--muted)]">{t.signedOutBody}</p>
            <Link href={`/auth/login?next=${encodeURIComponent(`/${locale}/me/inbox`)}` as Route} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-white">{t.signIn}</Link>
          </section>
        ) : null}

        {state === "blocked" || state === "unavailable" ? (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><CircleAlert aria-hidden="true" />{state === "blocked" ? t.blockedTitle : t.unavailableTitle}</h2>
            <p className="mt-3 leading-7">{state === "blocked" ? t.blockedBody : t.unavailableBody}</p>
            <button type="button" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full border border-amber-400 px-5 py-3 font-semibold" onClick={() => {
              setState("loading");
              setStatusMessage("");
              void load();
            }}><RotateCcw aria-hidden="true" />{t.retry}</button>
          </section>
        ) : null}

        {state === "ready" && page ? (
          <>
            <section className="mt-8" aria-labelledby="inbox-heading">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <h2 id="inbox-heading" className="flex items-center gap-2 text-2xl font-semibold text-[var(--fg)]"><Bell aria-hidden="true" />{t.inbox}</h2>
                  <p className="mt-2 text-sm text-[var(--muted)]">{t.unread}: <strong>{page.unreadCount}</strong></p>
                </div>
                <button type="button" disabled={page.unreadCount === 0 || busyKey === "read-all"} onClick={() => void markAllRead()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--pa-color-accent-border-14)] px-5 py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"><CheckCheck aria-hidden="true" />{t.markAll}</button>
              </div>

              {page.items.length ? (
                <ol className="mt-5 space-y-4">
                  {page.items.map((item) => {
                    const content = localizedContent(item, locale, t.fallbackTitle, t.fallbackSummary);
                    return (
                      <li key={item.messageId} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                          <span>{t.category[item.category]}</span>
                          <span aria-hidden="true">•</span>
                          <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time>

                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-[var(--fg)]">{content.title}</h3>
                        <p className="mt-2 leading-7 text-[var(--muted)]">{content.summary}</p>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span className="text-sm text-[var(--muted)]">{item.readAt ? t.read : t.unread}</span>
                          {!item.readAt ? (
                            <button type="button" disabled={busyKey === item.messageId} onClick={() => void markRead(item)} className="min-h-12 rounded-full border border-[var(--pa-color-accent-border-14)] px-5 py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-50">{t.markRead}</button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="mt-5 rounded-3xl border border-dashed border-[var(--border)] p-8 text-center">
                  <h3 className="text-xl font-semibold text-[var(--fg)]">{t.emptyTitle}</h3>
                  <p className="mt-2 text-[var(--muted)]">{t.emptyBody}</p>
                </div>
              )}



            </section>

            <section className="mt-12 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8" aria-labelledby="preferences-heading">
              <h2 id="preferences-heading" className="flex items-center gap-2 text-2xl font-semibold text-[var(--fg)]"><Mail aria-hidden="true" />{t.preferences}</h2>
              <p className="mt-3 max-w-3xl leading-7 text-[var(--muted)]">{t.preferencesBody}</p>
              <ul className="mt-6 divide-y divide-[var(--border)]">
                {optionalCategories.map((category) => {
                  const enabled = emailPreferences.get(category)?.enabled ?? false;
                  const key = `preference:${category}`;
                  return (
                    <li key={category} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
                      <div>
                        <h3 className="font-semibold text-[var(--fg)]">{t.category[category]}</h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">{enabled ? t.enabled : t.disabled}</p>
                      </div>
                      <button type="button" aria-pressed={enabled} disabled={busyKey === key} onClick={() => void updatePreference(category, !enabled)} className="min-h-12 rounded-full border border-[var(--pa-color-accent-border-14)] px-5 py-3 text-sm font-semibold text-[var(--accent)] disabled:opacity-50">{enabled ? t.disable : t.enable}</button>
                    </li>
                  );
                })}

              </ul>
            </section>
          </>
        ) : null}

        <p className="sr-only" role="status" aria-live="polite">{statusMessage}</p>
      </main>
    </div>
  );
}
