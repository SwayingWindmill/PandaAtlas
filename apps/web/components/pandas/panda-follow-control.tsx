"use client";

import type { Route } from "next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface PandaFollowControlProps {
  stableId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
}

type FollowUiState = "loading" | "signed-out" | "not-following" | "following";
type FollowOutcome =
  | "followed"
  | "already-followed"
  | "cancelled"
  | "intent-expired"
  | "auth-failed"
  | "session-expired";

const messages = {
  zh: {
    unavailable: "关注暂时不可用，请稍后重试。",
    unfollowUnavailable: "暂时无法取消关注。",
    followed: (name: string) => `已关注${name}。关注状态已同步到你的熊猫护照。`,
    already: (name: string) => `你已经关注${name}，无需重复操作。`,
    cancelled: "已取消登录，这只熊猫没有被关注。",
    expired: "登录成功，但关注请求已过期。请再次点击关注。",
    authFailed: "验证未完成，没有创建关注或邮件许可。",
    sessionExpired: "登录状态已过期。重新验证后会继续关注。",
    unfollowed: (name: string) => `已取消关注${name}。`,
    support: "关注会同步到你的账号和私有熊猫护照，不会自动开启邮件。",
    consentTitle: "需要重大动态邮件提醒吗？",
    consentBody: "关注不会自动订阅邮件。你可以单独开启重大动态邮件，或保持仅站内关注。",
    consentEnable: "开启重大动态邮件",
    consentSkip: "暂不开启邮件",
    consentEnabled: "已开启重大动态邮件。关注关系没有改变。",
    consentFailed: "邮件提醒暂时无法开启。关注关系不受影响。",
    passport: "查看熊猫护照",
  },
  en: {
    unavailable: "Follow is temporarily unavailable. Please try again.",
    unfollowUnavailable: "Unable to unfollow right now.",
    followed: (name: string) => `You now follow ${name}. The relationship is visible in your private Panda Passport.`,
    already: (name: string) => `You already follow ${name}; no duplicate relationship was created.`,
    cancelled: "Sign-in was cancelled. This panda was not followed.",
    expired: "Sign-in succeeded, but the Follow request expired. Select Follow again.",
    authFailed: "Verification did not complete. No Follow or email consent was created.",
    sessionExpired: "Your session expired. Verify again to continue the Follow request.",
    unfollowed: (name: string) => `You no longer follow ${name}.`,
    support: "Following syncs to your account and private Panda Passport. It never enables email automatically.",
    consentTitle: "Receive major-activity email updates?",
    consentBody: "Following does not subscribe you to email. Enable this category separately or keep account-only Follow updates.",
    consentEnable: "Enable major-activity email",
    consentSkip: "Not now",
    consentEnabled: "Major-activity email is enabled. The Follow relationship was not changed.",
    consentFailed: "Email updates could not be enabled. Your Follow relationship is unchanged.",
    passport: "Open Panda Passport",
  },
} as const;

function outcomeMessage(
  outcome: string | null,
  locale: "zh" | "en",
  name: string,
): string {
  const t = messages[locale];
  if (outcome === "followed") return t.followed(name);
  if (outcome === "already-followed") return t.already(name);
  if (outcome === "cancelled") return t.cancelled;
  if (outcome === "intent-expired") return t.expired;
  if (outcome === "auth-failed") return t.authFailed;
  if (outcome === "session-expired") return t.sessionExpired;
  return "";
}

export function PandaFollowControl({ stableId, slug, name, locale }: PandaFollowControlProps) {
  const engagementEnabled = isEngagementUiEnabled();
  const searchParams = useSearchParams();
  const [state, setState] = useState<FollowUiState>("loading");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(() => (
    outcomeMessage(searchParams.get("follow") as FollowOutcome | null, locale, name)
  ));
  const [showConsent, setShowConsent] = useState(false);
  const consentIdempotencyKey = useRef<string | null>(null);
  const returnPath = `/${locale}/pandas/${slug}`;
  const passportPath = `/${locale}/me/passport` as Route;
  const t = messages[locale];

  useEffect(() => {
    if (!engagementEnabled) return;
    let cancelled = false;
    async function loadState() {
      const session = await fetch("/api/identity/session", { cache: "no-store" });
      if (cancelled) return;
      if (session.status === 401) {
        setState("signed-out");
        return;
      }
      if (!session.ok) {
        setState("not-following");
        setFeedback(t.unavailable);
        return;
      }
      const follow = await fetch(`/api/engagement/follows/${encodeURIComponent(stableId)}`, {
        cache: "no-store",
      });
      if (cancelled) return;
      if (follow.ok) {
        const value = await follow.json() as { state?: string };
        setState(value.state === "active" ? "following" : "not-following");
      } else if (follow.status === 404) {
        setState("not-following");
      } else if (follow.status === 401) {
        setState("signed-out");
      } else {
        setState("not-following");
        setFeedback(t.unavailable);
      }
    }
    void loadState();
    return () => {
      cancelled = true;
    };
  }, [engagementEnabled, stableId, t.unavailable]);

  async function beginAuthentication(reason?: "session-expired") {
    const response = await fetch("/api/engagement/follow-intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panda_id: stableId, locale, return_path: returnPath }),
    });
    if (!response.ok) {
      setBusy(false);
      setFeedback(t.unavailable);
      return;
    }
    const reasonQuery = reason ? `&reason=${reason}` : "";
    window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}${reasonQuery}`);
  }

  async function startFollow() {
    setBusy(true);
    setFeedback("");
    setShowConsent(false);
    if (state === "signed-out") {
      await beginAuthentication();
      return;
    }

    const response = await fetch(`/api/engagement/follows/${encodeURIComponent(stableId)}`, {
      method: "POST",
    });
    if (response.status === 401) {
      setState("signed-out");
      setFeedback(t.sessionExpired);
      await beginAuthentication("session-expired");
      return;
    }
    setBusy(false);
    if (!response.ok) {
      setFeedback(t.unavailable);
      return;
    }
    setState("following");
    setFeedback(t.followed(name));
    setShowConsent(true);
  }

  async function stopFollow() {
    setBusy(true);
    setShowConsent(false);
    const response = await fetch(`/api/engagement/follows/${encodeURIComponent(stableId)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!response.ok) {
      setFeedback(t.unfollowUnavailable);
      return;
    }
    setState("not-following");
    setFeedback(t.unfollowed(name));
  }

  async function enableEmailConsent() {
    setBusy(true);
    consentIdempotencyKey.current ??= `preference-${crypto.randomUUID()}`;
    const response = await fetch("/api/engagement/preferences/major_activity/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        idempotency_key: consentIdempotencyKey.current,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setFeedback(t.consentFailed);
      return;
    }
    setShowConsent(false);
    setFeedback(t.consentEnabled);
  }

  if (!engagementEnabled) return null;

  const following = state === "following";
  const label = locale === "zh"
    ? (following ? `取消关注${name}` : `关注${name}`)
    : (following ? `Unfollow ${name}` : `Follow ${name}`);

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <button
        type="button"
        disabled={busy || state === "loading"}
        aria-busy={busy || state === "loading"}
        aria-pressed={following}
        aria-label={label}
        onClick={() => void (following ? stopFollow() : startFollow())}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-px disabled:cursor-wait disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 sm:w-auto"
      >
        <Heart className={`h-4 w-4 ${following ? "fill-current" : ""}`} aria-hidden="true" />
        {locale === "zh"
          ? (following ? "已关注" : `关注${name}`)
          : (following ? "Following" : `Follow ${name}`)}
      </button>

      <p className="text-sm leading-6 text-[var(--muted)]">{t.support}</p>

      {following ? (
        <Link className="min-h-12 self-start rounded-lg px-1 py-3 font-semibold underline underline-offset-4" href={passportPath}>
          {t.passport}
        </Link>
      ) : null}

      {showConsent ? (
        <section className="grid gap-3 rounded-xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-4" aria-labelledby="email-consent-title">
          <h2 id="email-consent-title" className="text-lg font-bold">{t.consentTitle}</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">{t.consentBody}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void enableEmailConsent()}
              className="min-h-12 rounded-lg bg-[var(--accent)] px-4 py-3 font-semibold text-white"
            >
              {t.consentEnable}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowConsent(false)}
              className="min-h-12 rounded-lg border border-[var(--pa-color-accent-border-12)] px-4 py-3 font-semibold"
            >
              {t.consentSkip}
            </button>
          </div>
        </section>
      ) : null}

      {feedback ? (
        <p className="rounded-lg border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] px-3 py-2 text-sm leading-6" role="status" tabIndex={-1}>
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
