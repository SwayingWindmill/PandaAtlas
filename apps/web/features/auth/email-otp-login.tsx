"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const SAFE_APP_PATH = /^\/(?:admin(?:\/.*)?|(zh|en)\/(?:pandas\/[a-z0-9-]+|contribute|me\/(?:passport|feed|inbox|submissions(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?)))$/;

function safeNextPath(value: string | null): string {
  const fallback = "/admin";
  const base = "https://panda-atlas.invalid";
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || !URL.canParse(value, base)
  ) return fallback;
  const destination = new URL(value, base);
  if (destination.origin !== base) return fallback;
  const path = destination.pathname;
  if (!SAFE_APP_PATH.test(path)) return fallback;
  return path;
}

function withFollowOutcome(path: string, outcome: string): string {
  const url = new URL(path, "https://panda-atlas.invalid");
  url.searchParams.set("follow", outcome);
  return `${url.pathname}${url.search}`;
}

interface PendingFollowContext {
  panda_id: string;
  locale: "zh" | "en";
  safe_return_path: string;
  status: string;
  outcome?: string | null;
}

interface FollowCompletion {
  status: string;
  outcome: "followed" | "already_followed" | "intent_expired" | "cancelled";
  safe_return_path: string;
}

type Phase = "email" | "otp" | "consent";
type MessageKind = "status" | "error";

const copy = {
  zh: {
    account: "吱熊猫账号",
    heading: "使用邮箱验证码登录",
    pendingSupport: "验证码登录成功后才会完成收藏。邮件继续入口不会自动登录。",
    accountSupport: "登录后，吱熊猫会再次核对账号状态和可用权限。",
    pandaContext: (slug: string) => `待收藏熊猫：${slug}`,
    expiredSession: "登录状态已过期。重新验证后会继续收藏。",
    email: "邮箱",
    send: "发送验证码",
    sending: "正在发送…",
    sendSafe: "如果该邮箱可用，我们已发送验证码。",
    sendFailed: "验证码发送失败，请稍后重试。",
    cancel: "取消登录并返回熊猫资料页",
    otp: "6 位验证码",
    verify: "验证并登录",
    verifying: "正在验证…",
    changeEmail: "更换邮箱",
    invalidOtp: "验证码不正确，请检查后重试。",
    magicLinkFailed: "登录链接无效或已过期，请重新登录。",
    completionFailed: "收藏暂时无法完成，请返回熊猫资料页后重试。",
    consentTitle: "要接收重要熊猫动态邮件吗？",
    consentBody: "收藏不会自动订阅邮件。你的收藏和熊猫护照会保留。",
    consentEnable: "开启重要动态邮件",
    consentEnabling: "正在开启…",
    consentSkip: "暂不开启邮件，返回熊猫资料页",
    consentFailed: "邮件提醒暂时无法开启。收藏和站内状态不受影响。",
    followed: "已收藏。熊猫已加入你的“我的熊猫”和熊猫护照。",
  },
  en: {
    account: "ZhiPanda account",
    heading: "Sign in with an email code",
    pendingSupport: "Saving this panda completes only after code verification. An email continuation link never signs you in by itself.",
    accountSupport: "After sign-in, ZhiPanda checks your account status and available access again.",
    pandaContext: (slug: string) => `Panda to favorite: ${slug}`,
    expiredSession: "Your session expired. Verify again to continue favoriting this panda.",
    email: "Email",
    send: "Send verification code",
    sending: "Sending…",
    sendSafe: "If that email can be used, a verification code has been sent.",
    sendFailed: "The verification code could not be sent. Try again later.",
    cancel: "Cancel sign-in and return to the panda profile",
    otp: "6-digit verification code",
    verify: "Verify and sign in",
    verifying: "Verifying…",
    changeEmail: "Use another email",
    invalidOtp: "That verification code is not correct. Check it and try again.",
    magicLinkFailed: "That sign-in link is invalid or expired. Sign in again.",
    completionFailed: "This panda could not be favorited. Return to the profile and try again.",
    consentTitle: "Receive important panda updates by email?",
    consentBody: "Favoriting never subscribes you to email automatically. Your favorite and Panda Passport remain available either way.",
    consentEnable: "Enable important update emails",
    consentEnabling: "Enabling…",
    consentSkip: "Not now; return to the panda profile",
    consentFailed: "Email updates could not be enabled. Your favorite and account state are unchanged.",
    followed: "This panda is now in your favorites and Panda Passport.",
  },
} as const;

function localeFromPath(path: string): "zh" | "en" {
  return path.startsWith("/en/") ? "en" : "zh";
}

function pandaSlug(path: string): string | null {
  const match = path.match(/^\/(?:zh|en)\/pandas\/([a-z0-9-]+)$/);
  return match?.[1] ?? null;
}

export function EmailOtpLogin() {
  const searchParams = useSearchParams();
  const destination = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<Phase>("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => (
    searchParams.get("reason") === "session-expired" ? copy[localeFromPath(destination)].expiredSession : null
  ));
  const [messageKind, setMessageKind] = useState<MessageKind>("status");
  const [pending, setPending] = useState<PendingFollowContext | null>(null);
  const [returnPath, setReturnPath] = useState(destination);
  const consentIdempotencyKey = useRef<string | null>(null);
  const adminAuthRestoreStartedRef = useRef(false);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const messageRef = useRef<HTMLParagraphElement | null>(null);
  const locale = pending?.locale ?? localeFromPath(returnPath);
  const t = copy[locale];

  useEffect(() => {
    if (phase === "otp") otpInputRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (messageKind === "error" && message) messageRef.current?.focus();
  }, [message, messageKind]);

  useEffect(() => {
    if (!destination.startsWith("/admin")) return;
    if (adminAuthRestoreStartedRef.current) return;

    const currentUrl = new URL(window.location.href);
    const authCode = currentUrl.searchParams.get("code");
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");
    if (!authCode && (!accessToken || !refreshToken)) return;

    adminAuthRestoreStartedRef.current = true;
    async function restoreMagicLinkSession() {
      const client = getSupabaseBrowserClient();
      await (authCode
        ? await client.auth.exchangeCodeForSession(authCode)
        : await client.auth.setSession({
            access_token: accessToken as string,
            refresh_token: refreshToken as string,
          }));

      const cleanedUrl = new URL(window.location.href);
      cleanedUrl.searchParams.delete("code");
      cleanedUrl.hash = "";
      history.replaceState(null, "", `${cleanedUrl.pathname}${cleanedUrl.search}`);
      const adminSession = await fetch("/api/admin/session", { cache: "no-store" });
      if (!adminSession.ok) {
        adminAuthRestoreStartedRef.current = false;
        setMessage(copy[localeFromPath(destination)].magicLinkFailed);
        setMessageKind("error");
        return;
      }
      window.location.replace(destination);
    }
    void restoreMagicLinkSession();
  }, [destination]);

  useEffect(() => {
    let cancelled = false;
    async function restorePendingFollow() {
      const fragment = new URLSearchParams(window.location.hash.slice(1)).get("continue");
      if (fragment) {
        const continuation = await fetch("/api/engagement/follow-intents/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ continuation_handle: fragment }),
        });
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        if (!continuation.ok && !cancelled) {
          setMessage(copy[localeFromPath(destination)].completionFailed);
          setMessageKind("error");
        }
      }
      const response = await fetch("/api/engagement/follow-intents", { cache: "no-store" });
      if (!cancelled && response.ok) {
        const value = await response.json() as PendingFollowContext;
        setPending(value);
        setReturnPath(safeNextPath(value.safe_return_path));
      }
    }
    void restorePendingFollow();
    return () => {
      cancelled = true;
    };
  }, [destination]);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/auth/email-otp/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: returnPath }),
    });
    setBusy(false);
    if (!response.ok) {
      setMessage(t.sendFailed);
      setMessageKind("error");
      return;
    }
    setPhase("otp");
    setMessage(t.sendSafe);
    setMessageKind("status");
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await getSupabaseBrowserClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: "email",
    });
    if (result.error || !result.data.session) {
      setBusy(false);
      setMessage(t.invalidOtp);
      setMessageKind("error");
      setOtp("");
      return;
    }

    if (!pending) {
      window.location.replace(destination);
      return;
    }

    const completionResponse = await fetch("/api/engagement/follows/complete-pending", {
      method: "POST",
    });
    setBusy(false);
    if (completionResponse.status === 401) {
      setPhase("email");
      setMessage(t.expiredSession);
      setMessageKind("error");
      return;
    }
    if (!completionResponse.ok) {
      setMessage(t.completionFailed);
      setMessageKind("error");
      return;
    }
    const completion = await completionResponse.json() as FollowCompletion;
    const canonicalReturn = safeNextPath(completion.safe_return_path);
    setReturnPath(canonicalReturn);
    if (completion.outcome === "intent_expired" || completion.status === "expired") {
      window.location.replace(withFollowOutcome(canonicalReturn, "intent-expired"));
      return;
    }
    if (completion.outcome === "already_followed") {
      window.location.replace(withFollowOutcome(canonicalReturn, "already-followed"));
      return;
    }
    setMessage(t.followed);
    setMessageKind("status");
    setPhase("consent");
  }

  async function enableMajorActivityEmail() {
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
      setMessage(t.consentFailed);
      setMessageKind("error");
      return;
    }
    window.location.replace(withFollowOutcome(returnPath, "followed"));
  }

  async function cancelAuthentication() {
    setBusy(true);
    await fetch("/api/engagement/follow-intents/cancel", { method: "POST" });
    setBusy(false);
    window.location.replace(withFollowOutcome(returnPath, "cancelled"));
  }

  const contextSlug = pandaSlug(returnPath);

  return (
    <section className="mx-auto grid min-h-[70vh] max-w-md place-content-center overflow-x-hidden px-4 py-12">
      <div className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-stone-700">{t.account}</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-950">{t.heading}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          {pending ? t.pendingSupport : t.accountSupport}
        </p>
        {contextSlug ? (
          <p className="mt-3 rounded-lg bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-900">
            {t.pandaContext(contextSlug)}
          </p>
        ) : null}

        {phase === "email" ? (
          <form className="mt-6 grid gap-4" onSubmit={requestOtp}>
            <label className="grid gap-2 text-sm font-medium text-stone-900">
              {t.email}
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-12 text-base"
              />
            </label>
            <Button className="min-h-12 w-full" disabled={busy || !email.trim()} type="submit">
              {busy ? t.sending : t.send}
            </Button>
            {pending ? (
              <Button
                className="min-h-12 w-full"
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void cancelAuthentication()}
              >
                {t.cancel}
              </Button>
            ) : null}
          </form>
        ) : phase === "otp" ? (
          <form className="mt-6 grid gap-4" onSubmit={verifyOtp}>
            <label className="grid gap-2 text-sm font-medium text-stone-900">
              {t.otp}
              <Input
                ref={otpInputRef}
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                className="min-h-12 text-base tracking-[0.3em]"
              />
            </label>
            <Button className="min-h-12 w-full" disabled={busy || otp.length !== 6} type="submit">
              {busy ? t.verifying : t.verify}
            </Button>
            <Button
              className="min-h-12 w-full"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPhase("email");
                setOtp("");
                setMessage(null);
              }}
            >
              {t.changeEmail}
            </Button>
          </form>
        ) : (
          <div className="mt-6 grid gap-4">
            <h2 className="text-xl font-bold text-stone-950">{t.consentTitle}</h2>
            <p className="text-sm leading-6 text-stone-700">{t.consentBody}</p>
            <Button className="min-h-12 w-full" type="button" disabled={busy} onClick={() => void enableMajorActivityEmail()}>
              {busy ? t.consentEnabling : t.consentEnable}
            </Button>
            <Button
              className="min-h-12 w-full"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => window.location.replace(withFollowOutcome(returnPath, "followed"))}
            >
              {t.consentSkip}
            </Button>
          </div>
        )}

        {message ? (
          <p
            ref={messageRef}
            className="mt-4 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800"
            role={messageKind === "error" ? "alert" : "status"}
            tabIndex={-1}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export { safeNextPath, withFollowOutcome };
