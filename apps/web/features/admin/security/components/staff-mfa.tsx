"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Step = "loading" | "setup" | "enrolling" | "challenge" | "ready";
type Enrollment = { factorId: string; qr: string; secret: string };

function adminReturnPath(next: string | null): string {
  return next && /^\/admin(?:\/[a-z0-9-]+)*$/.test(next) && next !== "/admin/security/mfa"
    ? next
    : "/admin";
}

export function StaffMfa() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const destination = adminReturnPath(searchParams.get("next"));
  const [step, setStep] = useState<Step>("loading");
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session?.capabilities.includes("admin.shell.access")) return;
    async function load() {
      const auth = getSupabaseBrowserClient().auth;
      const [assurance, factors] = await Promise.all([
        auth.mfa.getAuthenticatorAssuranceLevel(),
        auth.mfa.listFactors(),
      ]);
      if (assurance.error || factors.error) {
        setError("无法读取多因素认证状态，请稍后重新加载页面。");
        return;
      }
      if (assurance.data.currentLevel === "aal2") {
        setStep("ready");
        return;
      }
      const verified = factors.data.totp.find((factor) => factor.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setStep("challenge");
      } else {
        setStep("setup");
      }
    }
    void load();
  }, [session?.accountId, session?.capabilities]);

  async function beginEnrollment() {
    setBusy(true);
    setError("");
    const result = await getSupabaseBrowserClient().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "PandaAtlas 工作人员",
    });
    setBusy(false);
    if (result.error || !result.data.totp) {
      setError("生成验证器配置失败，请稍后重试。");
      return;
    }
    setEnrollment({
      factorId: result.data.id,
      qr: result.data.totp.qr_code,
      secret: result.data.totp.secret,
    });
    setStep("enrolling");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({
      factorId: enrollment?.factorId ?? factorId,
      code,
    });
    setBusy(false);
    if (result.error) {
      setCode("");
      setError("动态验证码无效，请检查验证器中的最新验证码。");
      return;
    }
    setEnrollment(null);
    setCode("");
    setStep("ready");
    await queryClient.invalidateQueries({ queryKey: adminSessionQueryOptions.queryKey });
  }

  if (!session?.capabilities.includes("admin.shell.access")) return null;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-10">
      <p className="text-xs font-semibold tracking-widest text-teal-700">PANDAATLAS · 身份安全</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">多因素认证</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        使用验证器应用生成动态验证码，确保工作人员能够安全执行涉及熊猫档案审核、策展与发布的敏感操作。
      </p>
      <section className="mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="多因素认证设置">
        {step === "loading" && <p role="status" className="text-sm text-slate-600">正在检查登录安全级别…</p>}

        {step === "setup" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950">启用验证器</h2>
            <p className="text-sm leading-6 text-slate-600">
              绑定验证器后，每次需要执行敏感操作时，都可以使用一次性动态验证码完成身份验证。
            </p>
            <Button type="button" disabled={busy} onClick={() => void beginEnrollment()}>
              {busy ? "正在生成…" : "开始设置"}
            </Button>
          </div>
        )}

        {step === "enrolling" && enrollment && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950">扫描二维码</h2>
            <p className="text-sm leading-6 text-slate-600">使用验证器应用扫描二维码，然后输入应用中显示的 6 位动态验证码。</p>
            {/* The Supabase Auth API returns the QR as an SVG data URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enrollment.qr} alt="用于绑定 PandaAtlas 验证器的二维码" width={208} height={208} className="rounded-lg border border-slate-200 p-2" />
            <div>
              <p className="text-sm text-slate-600">无法扫描？手动输入以下密钥：</p>
              <code className="mt-2 block break-all rounded-lg bg-slate-100 p-3 font-mono text-sm text-slate-900">{enrollment.secret}</code>
            </div>
            <MfaCodeForm code={code} setCode={setCode} busy={busy} onSubmit={verify} buttonText="绑定并验证" />
          </div>
        )}

        {step === "challenge" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950">验证登录身份</h2>
            <p className="text-sm leading-6 text-slate-600">输入已绑定验证器应用中显示的 6 位动态验证码，升级当前会话的安全级别。</p>
            <MfaCodeForm code={code} setCode={setCode} busy={busy} onSubmit={verify} buttonText="验证并继续" />
          </div>
        )}

        {step === "ready" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-950">身份验证已完成</h2>
            <p className="text-sm leading-6 text-slate-600">当前会话已达到 AAL2 安全级别。敏感操作仍需满足服务端的最近认证和岗位权限要求。</p>
            <Button asChild>
              <Link href={destination as Route}>返回工作区</Link>
            </Button>
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
      </section>
    </main>
  );
}

function MfaCodeForm({
  code, setCode, busy, onSubmit, buttonText,
}: {
  code: string;
  setCode: (code: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  buttonText: string;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-semibold text-slate-900">
        动态验证码
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          className="mt-2 max-w-64 tracking-[.25em]"
        />
      </label>
      <Button type="submit" disabled={busy || code.length !== 6}>{busy ? "正在验证…" : buttonText}</Button>
    </form>
  );
}
