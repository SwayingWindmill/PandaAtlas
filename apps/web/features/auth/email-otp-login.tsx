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

type Phase = "email" | "otp";
type MessageKind = "status" | "error";

const copy = {
  zh: {
    account: "吱熊猫账号",
    heading: "使用邮箱验证码登录",
    accountSupport: "登录后，吱熊猫会再次核对账号状态和可用权限。",
    expiredSession: "登录状态已过期，请重新验证。",
    email: "邮箱",
    send: "发送验证码",
    sending: "正在发送…",
    sendSafe: "如果该邮箱可用，我们已发送验证码。",
    sendFailed: "验证码发送失败，请稍后重试。",
    otp: "6 位验证码",
    verify: "验证并登录",
    verifying: "正在验证…",
    changeEmail: "更换邮箱",
    invalidOtp: "验证码不正确，请检查后重试。",
    magicLinkFailed: "登录链接无效或已过期，请重新登录。",
  },
  en: {
    account: "ZhiPanda account",
    heading: "Sign in with an email code",
    accountSupport: "After sign-in, ZhiPanda checks your account status and available access again.",
    expiredSession: "Your session expired. Verify again to continue.",
    email: "Email",
    send: "Send verification code",
    sending: "Sending…",
    sendSafe: "If that email can be used, a verification code has been sent.",
    sendFailed: "The verification code could not be sent. Try again later.",
    otp: "6-digit verification code",
    verify: "Verify and sign in",
    verifying: "Verifying…",
    changeEmail: "Use another email",
    invalidOtp: "That verification code is not correct. Check it and try again.",
    magicLinkFailed: "That sign-in link is invalid or expired. Sign in again.",
  },
} as const;

function localeFromPath(path: string): "zh" | "en" {
  return path.startsWith("/en/") ? "en" : "zh";
}

export function EmailOtpLogin() {
  const searchParams = useSearchParams();
  const destination = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
  const locale = localeFromPath(destination);
  const t = copy[locale];
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<Phase>("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => (
    searchParams.get("reason") === "session-expired" ? t.expiredSession : null
  ));
  const [messageKind, setMessageKind] = useState<MessageKind>("status");
  const adminAuthRestoreStartedRef = useRef(false);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const messageRef = useRef<HTMLParagraphElement | null>(null);

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
      const result = authCode
        ? await client.auth.exchangeCodeForSession(authCode)
        : await client.auth.setSession({
            access_token: accessToken as string,
            refresh_token: refreshToken as string,
          });
      if (result.error) {
        adminAuthRestoreStartedRef.current = false;
        setMessage(copy[localeFromPath(destination)].magicLinkFailed);
        setMessageKind("error");
        return;
      }

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

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/auth/email-otp/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: destination }),
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
    window.location.replace(destination);
  }

  return (
    <section className="mx-auto grid min-h-[70vh] max-w-md place-content-center overflow-x-hidden px-4 py-12">
      <div className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-stone-700">{t.account}</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-950">{t.heading}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-700">{t.accountSupport}</p>

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
          </form>
        ) : (
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

export { safeNextPath };
