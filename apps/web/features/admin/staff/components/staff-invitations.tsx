"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "@zhipanda/api-client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";

type Invitation = components["schemas"]["StaffInvitationDto"];

async function getInvitations(): Promise<Invitation[]> {
  const result = await fetch("/api/admin/staff/invitations", { cache: "no-store" });
  if (!result.ok) throw new Error(`读取邀请列表失败（${result.status}）`);
  return result.json() as Promise<Invitation[]>;
}

export function StaffInvitations() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  const queryClient = useQueryClient();
  const { data: invitations, isPending, error } = useQuery({
    queryKey: ["admin", "staff", "invitations"],
    queryFn: getInvitations,
    enabled: session?.capabilities.includes("identity.account.manage") ?? false,
  });
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  if (!session?.capabilities.includes("identity.account.manage")) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    const response = await fetch("/api/admin/staff/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitting(false);
    if (!response.ok) {
      setNotice(response.status === 403
        ? "当前操作需要有效的双重身份验证和最近登录。请在账号安全中完成验证。"
        : response.status === 409
          ? "该邮箱已注册或已有邀请，请先核对账号。"
          : "发送邀请失败，请稍后重试。");
      return;
    }
    setNotice("邀请邮件已发送。审核员验证邮箱后才能获得审核权限。");
    setEmail("");
    await queryClient.invalidateQueries({ queryKey: ["admin", "staff", "invitations"] });
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 md:px-8 md:py-10">
      <header>
        <p className="text-xs font-semibold tracking-widest text-teal-700">PANDAATLAS · 工作人员管理</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">邀请审核员</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          邀请协作者核实来源、处理待审记录。受邀者仅获得审核员职责，不能审批策展变更或发布熊猫档案。
        </p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">发送工作人员邀请</h2>
        <form onSubmit={(event) => void submit(event)} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm font-semibold text-slate-900">
            审核员邮箱
            <Input type="email" required autoComplete="email" placeholder="reviewer@example.com"
              value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2" />
          </label>
          <Button type="submit" disabled={submitting || !email.trim()}>{submitting ? "正在发送…" : "发送邀请"}</Button>
        </form>
        {notice && <p role="status" className="mt-4 text-sm text-slate-700">{notice}</p>}
        <p className="mt-4 text-xs text-slate-500">敏感操作要求 AAL2 与最近认证。<Link className="underline" href="/admin/security/mfa">账号安全设置</Link></p>
      </section>
      <section aria-label="审核员邀请记录">
        <h2 className="mb-3 text-lg font-bold text-slate-950">邀请记录</h2>
        {error && <p role="alert" className="text-sm text-rose-700">无法读取邀请记录。</p>}
        {isPending && <p className="text-sm text-slate-600">正在加载邀请记录…</p>}
        {invitations?.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">尚无审核员邀请。</p>}
        {invitations && invitations.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {invitations.map((invite) => (
              <li key={invite.invitationId} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="break-all text-slate-900">{invite.email}</span>
                <span className="shrink-0 font-semibold text-slate-700">{invite.status === "accepted" ? "已激活" : "等待验证"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
