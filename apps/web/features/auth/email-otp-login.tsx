"use client";

import type { Route } from "next";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiRequestError, requestJson } from "@/lib/api/request";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const SAFE_APP_PATH = /^\/(zh|en)\/(?:(?:pandas|places|institutions)\/[a-z0-9-]+|contribute|games\/(?:guess|daily)|me(?:\/(?:passport|feed|inbox|collections|memories|game-history|panda-book|submissions(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?))?)$/;

function safeNextPath(value: string | null): string {
  const fallback = "/zh/me";
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

/** Supabase Auth refuses another code for the same address within a minute, so the resend waits as long. */
const RESEND_SECONDS = 60;
/** Supabase Auth's `otp_expiry` (infra/supabase/config.toml). */
const CODE_LIFETIME_MS = 3_600_000;
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
    tooFrequent: "请求太频繁，请稍后再试。",
    resend: "重新发送验证码",
    resendIn: (seconds: number) => `${seconds} 秒后可重新发送`,
    resent: "新的验证码已发送。",
    otp: "6 位验证码",
    verify: "验证并登录",
    verifying: "正在验证…",
    changeEmail: "更换邮箱",
    invalidOtp: "验证码不正确，请检查后重试。",
    expiredOtp: "验证码已过期，请重新获取。",
    consentBefore: "登录即表示同意",
    terms: "《用户协议》",
    consentBetween: "和",
    privacy: "《隐私政策》",
    consentAfter: "",
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
    tooFrequent: "Too many requests. Try again in a moment.",
    resend: "Send a new code",
    resendIn: (seconds: number) => `Send a new code in ${seconds} s`,
    resent: "A new verification code has been sent.",
    otp: "6-digit verification code",
    verify: "Verify and sign in",
    verifying: "Verifying…",
    changeEmail: "Use another email",
    invalidOtp: "That verification code is not correct. Check it and try again.",
    expiredOtp: "That verification code has expired. Send a new one.",
    consentBefore: "Signing in means you agree to the ",
    terms: "Terms",
    consentBetween: " and the ",
    privacy: "Privacy",
    consentAfter: " policy",
  },
} as const;

function secondsUntilResend(sentAt: number, now: number): number {
  return Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - now) / 1000));
}

function localeFromPath(path: string): "zh" | "en" {
  return path.startsWith("/en/") ? "en" : "zh";
}

export function EmailOtpLogin() {
  const searchParams = useSearchParams();
  const destination = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
  const locale = localeFromPath(destination);
  const t = copy[locale];
  const localInboxUrl = process.env.NODE_ENV === "development"
    && process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:54321"
    ? "http://127.0.0.1:54324"
    : null;
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<Phase>("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => (
    searchParams.get("reason") === "session-expired" ? t.expiredSession : null
  ));
  const [messageKind, setMessageKind] = useState<MessageKind>("status");
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(0);
  const resendIn = secondsUntilResend(sentAt, now);
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  const messageRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (phase === "otp") otpInputRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (messageKind === "error" && message) messageRef.current?.focus();
  }, [message, messageKind]);

  useEffect(() => {
    if (resendIn === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  async function sendCode(): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    const failure = await requestJson("/api/auth/email-otp/start", {
      method: "POST",
      body: JSON.stringify({ email, next: destination }),
    }).then(() => null, (error: unknown) => (error instanceof ApiRequestError && error.status === 429 ? t.tooFrequent : t.sendFailed));
    setBusy(false);
    if (failure) {
      setMessage(failure);
      setMessageKind("error");
      return false;
    }
    const sent = Date.now();
    setSentAt(sent);
    setNow(sent);
    return true;
  }

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(await sendCode())) return;
    setPhase("otp");
    setMessage(t.sendSafe);
    setMessageKind("status");
  }

  async function resendOtp() {
    if (!(await sendCode())) return;
    setOtp("");
    setMessage(t.resent);
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
      // Supabase answers a wrong code and an expired one alike (otp_expired); the code's age tells them apart.
      setMessage(
        result.error?.status === 429
          ? t.tooFrequent
          : Date.now() - sentAt >= CODE_LIFETIME_MS
            ? t.expiredOtp
            : t.invalidOtp,
      );
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
              className="min-h-12 w-full tabular-nums"
              type="button"
              variant="outline"
              disabled={busy || resendIn > 0}
              onClick={() => void resendOtp()}
            >
              {resendIn > 0 ? t.resendIn(resendIn) : t.resend}
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
        {phase === "otp" && localInboxUrl ? (
          <p className="mt-4 text-sm leading-6 text-stone-700">
            本地开发环境的验证码只投递到测试邮箱，不会发送到真实邮箱。
            <a
              href={localInboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 font-semibold text-teal-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-teal-700"
            >
              打开本地验证码邮箱
            </a>
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-6 text-stone-700">
          {t.consentBefore}
          <Link href={`/${locale}/terms` as Route} className="font-semibold text-stone-950 underline underline-offset-2">
            {t.terms}
          </Link>
          {t.consentBetween}
          <Link href={`/${locale}/privacy` as Route} className="font-semibold text-stone-950 underline underline-offset-2">
            {t.privacy}
          </Link>
          {t.consentAfter}
        </p>
      </div>
    </section>
  );
}
