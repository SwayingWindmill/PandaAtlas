"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "@zhipanda/api-client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { StaffWorkspaceNavigation } from "./staff-workspace-navigation";

type Invitation = components["schemas"]["StaffInvitationDto"];

class InvitationRequestError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
  }
}

async function invitationFailure(response: Response): Promise<InvitationRequestError> {
  const problem: unknown = await response.json().catch(() => null);
  const code = problem && typeof problem === "object" && "code" in problem && typeof problem.code === "string"
    ? problem.code : "";
  const message = code === "auth.recentAuthRequired"
    ? "最近认证已过期。请重新使用邮箱验证码登录，并完成 TOTP 双重验证。"
    : code === "auth.aalRequired"
      ? "当前会话尚未完成双重身份验证，请前往账号安全验证。"
      : code === "auth.liveSessionRequired" || response.status === 401
        ? "当前登录会话已失效，请重新登录。"
        : response.status === 409
          ? "该邮箱已注册或已有邀请，请先核对账号。"
          : response.status === 403
            ? "当前账号没有执行此操作所需的权限。"
            : "邀请服务暂时不可用，请稍后重试。";
  return new InvitationRequestError(code || String(response.status), message);
}

function InvitationRecovery({ code }: { code: string }) {
  if (code === "auth.recentAuthRequired" || code === "auth.liveSessionRequired" || code === "401") {
    return <Link className="font-semibold underline" href="/auth/login?next=%2Fadmin%2Fstaff%2Finvitations">重新登录</Link>;
  }
  if (code === "auth.aalRequired") {
    return <Link className="font-semibold underline" href="/admin/security/mfa">前往账号安全</Link>;
  }
  return null;
}

async function getInvitations(): Promise<Invitation[]> {
  const result = await fetch("/api/admin/staff/invitations", { cache: "no-store" });
  if (!result.ok) throw await invitationFailure(result);
  return result.json() as Promise<Invitation[]>;
}

export function StaffInvitations() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  const canInvite = session?.capabilities.includes("identity.account.manage") ?? false;
  const canInspect = session?.capabilities.includes("identity.staff.read") || canInvite;
  const queryClient = useQueryClient();
  const { data: invitations, isPending, error } = useQuery({
    queryKey: ["admin", "staff", "invitations"],
    queryFn: getInvitations,
    enabled: canInspect,
    retry: false,
  });
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; code: string } | null>(null);

  if (!canInspect) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    const response = await fetch("/api/admin/staff/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const failure = await invitationFailure(response);
      setNotice({ message: failure.message, code: failure.code });
      return;
    }
    setNotice({ message: "邀请邮件已发送。审核员验证邮箱后才能获得审核权限。", code: "" });
    setEmail("");
    await queryClient.invalidateQueries({ queryKey: ["admin", "staff", "invitations"] });
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-12 pt-7 md:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">工作人员邀请</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          跟踪审核员邀请的验证进度。邀请授予的是审核职责，不包含策展终审或公开发布权限。
        </p>
      </header>
      {session && <StaffWorkspaceNavigation current="invitations" session={session} />}
      {canInvite && <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-950">发送工作人员邀请</h2>
        <p className="mt-1 text-sm text-slate-600">发出邀请后，对方需要打开邀请邮件并验证邮箱，才能获得审核员岗位。</p>
        <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-semibold text-slate-900">
            审核员邮箱
            <Input type="email" required autoComplete="email" placeholder="reviewer@example.com"
              value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2" />
          </label>
          <Button type="submit" disabled={submitting || !email.trim()}>{submitting ? "正在发送…" : "发送邀请"}</Button>
        </form>
        {notice && (
          <p role="status" className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
            {notice.message} <InvitationRecovery code={notice.code} />
          </p>
        )}
        <p className="mt-4 text-xs text-slate-600">邀请属于敏感授权操作，需完成高级身份验证。<Link className="underline" href="/admin/security/mfa">账号安全设置</Link></p>
      </section>}
      <section aria-label="审核员邀请记录">
        <h2 className="mb-3 text-lg font-bold text-slate-950">邀请记录</h2>
        {error && (
          <p role="alert" className="flex flex-wrap gap-2 text-sm text-rose-700">
            {error instanceof InvitationRequestError ? error.message : "无法读取邀请记录。"}
            {error instanceof InvitationRequestError && <InvitationRecovery code={error.code} />}
          </p>
        )}
        {isPending && <p className="text-sm text-slate-600">正在加载邀请记录…</p>}
        {invitations?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">尚无审核员邀请。</p>}
        {invitations && invitations.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {invitations.map((invite) => (
              <li key={invite.invitationId} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="break-all text-slate-900">{invite.email}</span>
                <span className="shrink-0 font-semibold text-slate-700">{invite.status === "accepted" ? "已激活" : invite.status === "pending" ? "等待对方验证邮箱" : "状态待核对"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
