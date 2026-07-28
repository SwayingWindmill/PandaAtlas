"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/admin";
  }
  try {
    const base = new URL("https://panda-atlas.invalid");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) {
      return "/admin";
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/admin";
  }
}

export function EmailOtpLogin() {
  const searchParams = useSearchParams();
  const destination = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"email" | "otp">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await getSupabaseBrowserClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (result.error) {
      setMessage("验证码发送失败，请稍后重试。");
      return;
    }
    setPhase("otp");
    setMessage("验证码已发送。请输入邮件中的 6 位数字。");
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
    setBusy(false);
    if (result.error || !result.data.session) {
      setMessage("验证码无效或已过期，请重新输入或获取新验证码。");
      return;
    }
    window.location.replace(destination);
  }

  return (
    <section className="mx-auto grid min-h-[70vh] max-w-md place-content-center px-4 py-12">
      <div className="rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-stone-700">PandaAtlas 工作人员入口</p>
        <h1 className="mt-2 text-2xl font-bold text-stone-950">使用邮箱验证码登录</h1>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          验证码登录成功后，FastAPI 会重新检查账号状态和数据库 Capability。登录本身不会授予任何工作人员权限。
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
          </form>
        ) : (
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
