"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { components } from "@zhipanda/api-client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { StaffWorkspaceNavigation } from "./staff-workspace-navigation";

type Invitation = components["schemas"]["StaffInvitationDto"];
type IssuedInvitation = components["schemas"]["IssuedStaffInvitationDto"];
type InvitationFilter = "all" | "pending" | "accepted" | "other";
type Notice = { kind: "success" | "error"; message: string; code: string };

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
    return <Link className="font-semibold underline underline-offset-4" href="/auth/login?next=%2Fadmin%2Fstaff%2Finvitations">重新登录</Link>;
  }
  if (code === "auth.aalRequired") {
    return <Link className="font-semibold underline underline-offset-4" href="/admin/security/mfa">前往账号安全</Link>;
  }
  return null;
}

async function getInvitations(): Promise<Invitation[]> {
  const response = await fetch("/api/admin/staff/invitations", { cache: "no-store" });
  if (!response.ok) throw await invitationFailure(response);
  return response.json() as Promise<Invitation[]>;
}

function invitationState(status: string): InvitationFilter {
  if (status === "pending" || status === "accepted") return status;
  return "other";
}

function invitationStatus(status: string) {
  switch (invitationState(status)) {
    case "pending": return { label: "待接受", variant: "outline" as const };
    case "accepted": return { label: "已接受", variant: "secondary" as const };
    default: return { label: "状态待核对", variant: "outline" as const };
  }
}

function createdAtLabel(date: string | undefined) {
  if (!date || !Number.isFinite(Date.parse(date))) return "创建时间未提供";
  return `创建于 ${new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(date))}（北京时间）`;
}

export function StaffInvitations() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  const canInvite = session?.capabilities.includes("identity.account.manage") ?? false;
  const canInspect = session?.capabilities.includes("identity.staff.read") || canInvite;
  const queryClient = useQueryClient();
  const { data: invitations, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "staff", "invitations"],
    queryFn: getInvitations,
    enabled: canInspect,
    retry: false,
  });
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvitationFilter>("all");

  if (!canInspect) return null;

  const matched = (invitations ?? []).filter((invitation) => (
    invitation.email.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (statusFilter === "all" || invitationState(invitation.status) === statusFilter)
  ));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/staff/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) throw await invitationFailure(response);
      const issued = await response.json() as IssuedInvitation;
      setNotice({
        kind: "success",
        message: `已向 ${issued.email} 发送邀请。对方完成邮箱验证并登录后才能获得审核员岗位。`,
        code: "",
      });
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "staff", "invitations"] });
    } catch (failure) {
      setNotice({
        kind: "error",
        message: failure instanceof InvitationRequestError ? failure.message : "网络连接失败，邀请可能未完成。请检查邀请记录后重试。",
        code: failure instanceof InvitationRequestError ? failure.code : "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-12 pt-7 md:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">工作人员邀请</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          邀请新审核员，查看他们是否已接受邀请。审核员不具备策展终审或公开发布权限。
        </p>
      </header>
      {session && <StaffWorkspaceNavigation current="invitations" session={session} />}

      {canInvite && (
        <section aria-labelledby="send-staff-invitation" className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="mb-4">
            <h2 id="send-staff-invitation" className="text-base font-semibold text-slate-950">邀请审核员</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">输入工作邮箱发送邀请。需要高级身份验证，对方接受邀请后才会获得岗位。</p>
          </div>
          <form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1 text-sm font-medium text-slate-900">
              审核员邮箱
              <Input
                type="email" name="email" required autoComplete="email" placeholder="reviewer@example.com"
                value={email} disabled={submitting}
                onChange={(event) => { setEmail(event.target.value); setNotice(null); }}
                className="mt-2"
              />
            </label>
            <Button type="submit" disabled={submitting}>{submitting ? "正在发送…" : "发送邀请"}</Button>
          </form>
          {notice && (
            <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-4 flex flex-wrap gap-2 text-sm ${notice.kind === "error" ? "text-rose-700" : "text-teal-800"}`}>
              {notice.message} <InvitationRecovery code={notice.code} />
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            邀请由账号安全策略保护。<Link className="font-medium underline underline-offset-4" href="/admin/security/mfa">查看双重验证设置</Link>
          </p>
        </section>
      )}

      <section aria-label="审核员邀请记录" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">邀请记录</h2>
            {invitations && <p className="mt-1 text-sm text-slate-600" aria-live="polite">{matched.length} / {invitations.length} 条邀请</p>}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-slate-700">
              <span className="sr-only">搜索邀请邮箱</span>
              <span className="relative block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input aria-label="搜索邀请邮箱" type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                  placeholder="搜索邀请邮箱" className="w-64 max-w-full pl-9" />
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              <span className="sr-only">邀请状态</span>
              <select aria-label="邀请状态" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InvitationFilter)}
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                <option value="all">全部状态</option>
                <option value="pending">待接受</option>
                <option value="accepted">已接受</option>
                <option value="other">其他状态</option>
              </select>
            </label>
          </div>
        </div>
        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <span>{error instanceof InvitationRequestError ? error.message : "无法读取邀请记录，请重试。"}</span>
            {error instanceof InvitationRequestError && <InvitationRecovery code={error.code} />}
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>重新加载</Button>
          </div>
        )}
        {isPending && !error && (
          <div aria-label="正在加载邀请记录" className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        )}
        {invitations?.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm leading-6 text-slate-600">
            尚无邀请记录。{canInvite ? "在上方输入邮箱，即可邀请第一位审核员。" : "需要邀请新审核员时，请联系具备人员邀请权限的同事。"}
          </p>
        )}
        {invitations && invitations.length > 0 && matched.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6">
            <h3 className="font-medium text-slate-900">没有匹配的邀请记录</h3>
            <p className="mt-1 text-sm text-slate-600">尝试其他邮箱或状态，或清除筛选查看全部记录。</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(""); setStatusFilter("all"); }}>清除筛选</Button>
          </div>
        )}
        {matched.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600 md:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)_auto]">
              <span>邮箱</span><span className="hidden md:block">邀请时间</span><span>进度</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {matched.map((invite) => {
                const status = invitationStatus(invite.status);
                return (
                  <li key={invite.invitationId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(11rem,auto)_auto]">
                    <span className="min-w-0 break-all font-medium text-slate-900">{invite.email}</span>
                    <span className="hidden whitespace-nowrap text-slate-600 md:block">{createdAtLabel(invite.createdAt)}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {matched.some((invite) => invitationState(invite.status) === "pending") && (
          <p className="text-xs leading-5 text-slate-600">“待接受”表示邀请已创建，但对方尚未完成邮箱验证与登录；此处仅展示服务端记录，不提供重发或撤销操作。</p>
        )}
      </section>
    </main>
  );
}
