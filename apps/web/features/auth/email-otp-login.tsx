"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function safeNextPath(value: string | null): string {
  const fallback = "/admin";
  const base = "https://panda-atlas.invalid";
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || !URL.canParse(value, base)
  ) {
    return fallback;
  }
  const destination = new URL(value, base);
  if (destination.origin !== base) return fallback;
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

interface PendingFollowContext {
  panda_id: string;
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

export function EmailOtpLogin() {
  const searchParams = useSearchParams();
  const destination = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<Phase>("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFollowContext | null>(null);
  const [returnPath, setReturnPath] = useState(destination);
  const consentIdempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function restorePendingFollow() {
      const fragment = new URLSearchParams(window.location.hash.slice(1)).get("continue");
      if (fragment) {
        await fetch("/api/engagement/follow-intents/continue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ continuation_handle: fragment }),
        });
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
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
  }, []);

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
      setMessage("验证码发送失败，请稍后重试。");
      return;
    }
    setPhase("otp");
    setMessage("如果该邮箱可用，我们已发送验证码。");
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
      setMessage("验证码不正确，请检查后重试。");
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
      setMessage("登录状态已过期。重新验证后会继续关注。");
      return;
    }
    if (!completionResponse.ok) {
      setMessage("关注暂时无法完成，请返回档案后重试。");
      return;
    }
    const completion = await completionResponse.json() as FollowCompletion;
    setReturnPath(safeNextPath(completion.safe_return_path));
    if (completion.outcome === "intent_expired" || completion.status === "expired") {
      setMessage("登录成功，但关注请求已过期。请再次点击关注。");
      return;
    }
    if (completion.outcome === "already_followed") {
      setMessage("你已经关注这只熊猫，无需重复操作。");
    } else {
      setMessage("已关注。今后重要动态会出现在你的关注动态和护照中。");
    }
    setPhase("consent");
  }

  async function enableMajorActivityEmail() {
    setBusy(true);
    consentIdempotencyKey.current ??= `preference-${crypto.randomUUID()}`;
    const response = await fetch(
      "/api/engagement/preferences/major_activity/email",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          idempotency_key: consentIdempotencyKey.current,
        }),
      },
    );
    setBusy(false);
    if (!response.ok) {
      setMessage("邮件提醒暂时无法开启。关注关系和站内通知不受影响。");
      return;
    }
    window.location.replace(returnPath);
  }

  async function cancelAuthentication() {
    setBusy(true);
    await fetch("/api/engagement/follow-intents/cancel", { method: "POST" });
    setBusy(false);
    setPending(null);
    setMessage("已取消登录，这只熊猫没有被关注。");
  }

  return (
    <section className="mx-auto grid min-h-[70vh] max-w-md place-content-center px-4 py-12">
      <div className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-stone-700">PandaAtlas 账号</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-950">使用邮箱验证码登录</h1>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          {pending
            ? "验证码登录成功后才会完成关注。邮件继续入口不会自动登录。"
            : "登录后，FastAPI 会重新检查账号状态和数据库权限。"}
        </p>

        {phase === "email" ? (
          <form className="mt-6 grid gap-4" onSubmit={requestOtp}>
            <label className="grid gap-2 text-sm font-medium text-stone-900">
              邮箱
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
            <Button className="min-h-12" disabled={busy || !email.trim()} type="submit">
              {busy ? "正在发送…" : "发送验证码"}
            </Button>
            {pending ? (
              <Button
                className="min-h-12"
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void cancelAuthentication()}
              >
                取消登录
              </Button>
            ) : null}
          </form>
        ) : phase === "otp" ? (
          <form className="mt-6 grid gap-4" onSubmit={verifyOtp}>
            <label className="grid gap-2 text-sm font-medium text-stone-900">
              6 位验证码
              <Input
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
            <Button className="min-h-12" disabled={busy || otp.length !== 6} type="submit">
              {busy ? "正在验证…" : "验证并登录"}
            </Button>
            <Button
              className="min-h-12"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPhase("email");
                setOtp("");
                setMessage(null);
              }}
            >
              更换邮箱
            </Button>
          </form>
        ) : (
          <div className="mt-6 grid gap-4">
            <h2 className="text-xl font-bold text-stone-950">需要重大动态邮件提醒吗？</h2>
            <p className="text-sm leading-6 text-stone-700">
              关注不会自动订阅邮件。站内通知仍会保留。
            </p>
            <Button
              className="min-h-12"
              type="button"
              disabled={busy}
              onClick={() => void enableMajorActivityEmail()}
            >
              {busy ? "正在开启…" : "开启重大动态邮件"}
            </Button>
            <Button
              className="min-h-12"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => window.location.replace(returnPath)}
            >
              暂不，查看关注动态
            </Button>
          </div>
        )}

        {message ? (
          <p
            className="mt-4 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800"
            role="status"
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export { safeNextPath };
