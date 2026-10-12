"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, ArrowUpRight, ClipboardCheck, Database, LockKeyhole,
  ShieldCheck, Activity, CircleArrowRight,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { auditEvidenceQueryOptions } from "@/features/admin/audit/api/queries";
import { auditEventName, auditObjectName } from "@/features/admin/audit/presentation";
import { curationListQueryOptions } from "@/features/admin/curation/api/queries";
import { reviewQueueQueryOptions } from "@/features/admin/review-moderation/api/queries";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { visibleAdminNavigationItems } from "@/features/admin/shell/navigation";

function QueueValue({ count, loading, error }: { count?: number; loading: boolean; error: boolean }) {
  if (error) return <span role="status" className="text-sm font-medium text-rose-700">暂时无法读取</span>;
  if (loading) return <Skeleton aria-label="正在读取队列" className="h-11 w-16 rounded-lg bg-slate-100" />;
  return <span className="text-[40px] font-semibold leading-none tracking-[-0.055em] text-slate-950 tabular-nums">{count}</span>;
}

export function AdminOverview() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  const canReview = session?.capabilities.includes("review.case.read") ?? false;
  const canCurate = session?.capabilities.includes("curation.change.read") ?? false;
  const canAudit = session?.capabilities.includes("audit.read") ?? false;
  const review = useQuery({
    ...reviewQueueQueryOptions({ state: "new", limit: 1, offset: 0 }),
    enabled: canReview, retry: false,
  });
  const curation = useQuery({
    ...curationListQueryOptions({ state: "validated", limit: 1, offset: 0 }),
    enabled: canCurate, retry: false,
  });
  const audit = useQuery({ ...auditEvidenceQueryOptions(5), enabled: canAudit, retry: false });

  if (!session) return null;

  const workspaces = visibleAdminNavigationItems(session).filter((item) => ![
    "/admin", "/admin/capabilities", "/admin/security/mfa",
    ...(canReview ? ["/admin/reviews"] : []),
    ...(canCurate ? ["/admin/curation"] : []),
  ].includes(item.href));

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-8 px-6 pb-14 pt-9 md:px-9 md:pt-11">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-[#287261]">
            <span className="size-1.5 rounded-full bg-[#287261]" aria-hidden="true" /> PANDAATLAS / WORKSPACE
          </div>
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.035em] text-slate-950 md:text-[34px]">数据运营工作台</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">查看需要处理的真实队列、最近操作与已授权的工作区。</p>
        </div>
        <Button asChild variant="outline" className="h-10 gap-2 rounded-lg border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50">
          <Link href="/admin/capabilities"><ShieldCheck size={16} aria-hidden="true" /> 查看我的权限 <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </Button>
      </header>

      {session.capabilities.includes("admin.shell.access") && session.aal !== "aal2" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5">
          <p className="flex items-center gap-2 text-sm text-amber-950"><LockKeyhole size={17} aria-hidden="true" />敏感审批和账号授权需要完成双重验证，普通查看不受影响。</p>
          <Link href="/admin/security/mfa" className="text-sm font-semibold text-amber-950 underline underline-offset-4 focus-visible:outline-2">前往账号安全</Link>
        </div>
      )}

      <section aria-label="待处理的工作" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-950">待处理的工作</h2>
            <p className="mt-1 text-xs text-slate-500">当前队列中的待办事项，不代表今日新增</p>
          </div>
          {(canReview || canCurate) && <Badge variant="outline" className="border-slate-200 bg-white px-2.5 py-1 font-normal text-slate-600">实时队列</Badge>}
        </div>
        {canReview || canCurate ? (
          <div className="grid gap-4 md:grid-cols-2">
            {canReview && (
              <Card className="group gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white py-0 shadow-[0_1px_3px_rgb(20_48_43_/_0.035)] transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between px-6 pb-1 pt-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[#e9f6f1] text-[#176b5a]"><ClipboardCheck size={21} aria-hidden="true" /></span>
                  <Badge variant="outline" className="border-slate-200 text-[11px] font-medium text-slate-500">贡献审核</Badge>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-5 pt-4">
                  <div className="flex items-end justify-between gap-3">
                    <div className="space-y-2">
                      <CardDescription className="text-sm font-medium text-slate-600">待分派审核案件</CardDescription>
                      <div aria-live="polite"><QueueValue count={review.data?.total} loading={review.isPending} error={review.isError} /></div>
                    </div>
                  </div>
                  <p className="min-h-5 text-xs leading-5 text-slate-500">{review.isError ? "可以进入队列检查并重试" : review.data?.total === 0 ? "目前没有新提交的案件" : "新提交的材料等待领取和来源核验"}</p>
                </CardContent>
                <Separator className="bg-slate-100" />
                <Link href="/admin/reviews?state=new" aria-label="进入审核队列" className="flex min-h-12 items-center justify-between px-6 text-[13px] font-semibold text-[#176b5a] transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#176b5a]">
                  进入审核队列 <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </Card>
            )}
            {canCurate && (
              <Card className="group gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white py-0 shadow-[0_1px_3px_rgb(20_48_43_/_0.035)] transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between px-6 pb-1 pt-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[#edf1fa] text-[#4b6292]"><Database size={21} aria-hidden="true" /></span>
                  <Badge variant="outline" className="border-slate-200 text-[11px] font-medium text-slate-500">档案策展</Badge>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-5 pt-4">
                  <div className="space-y-2">
                    <CardDescription className="text-sm font-medium text-slate-600">等待独立审批的变更</CardDescription>
                    <div aria-live="polite"><QueueValue count={curation.data?.total} loading={curation.isPending} error={curation.isError} /></div>
                  </div>
                  <p className="min-h-5 text-xs leading-5 text-slate-500">{curation.isError ? "可以进入策展页面检查并重试" : curation.data?.total === 0 ? "目前没有等待审批的变更" : "已核验的档案变更，等待独立审批"}</p>
                </CardContent>
                <Separator className="bg-slate-100" />
                <Link href="/admin/curation?state=validated" aria-label="进入策展变更" className="flex min-h-12 items-center justify-between px-6 text-[13px] font-semibold text-[#176b5a] transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#176b5a]">
                  进入策展变更 <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </Card>
            )}
          </div>
        ) : (
          <Card className="gap-2 rounded-2xl border-slate-200 bg-white px-6 py-6 shadow-xs">
            <p className="text-sm font-medium text-slate-900">当前没有可在首页处理的任务队列。</p>
            <p className="text-sm leading-6 text-slate-600">可以使用下方已授权的工作区，不需要额外的身份验证来查看已有记录。</p>
          </Card>
        )}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,1fr)]">
        <section aria-label="最近操作" className="min-w-0">
          <Card className="gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white py-0 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2.5 text-base font-semibold"><Activity size={17} className="text-[#176b5a]" aria-hidden="true" />最近操作</CardTitle>
                <CardDescription className="text-xs">最新的可查看操作记录</CardDescription>
              </div>
              {canAudit && <Link href="/admin/audit/evidence" className="inline-flex items-center gap-1 text-xs font-semibold text-[#176b5a] hover:underline">查看审计记录 <ArrowUpRight size={14} aria-hidden="true" /></Link>}
            </CardHeader>
            <CardContent className="min-h-48 px-0">
              {canAudit ? (
                audit.isPending ? <p role="status" className="px-6 py-8 text-sm text-slate-600">正在读取最近操作…</p>
                  : audit.isError ? <p role="status" className="px-6 py-8 text-sm text-slate-600">审计记录暂时不可用，可前往审计工作区查看。</p>
                    : audit.data?.length ? (
                      <ul className="divide-y divide-slate-100">
                        {audit.data.slice(0, 4).map((event) => (
                          <li key={event.sourceEventId} className="flex items-start gap-4 px-6 py-4">
                            <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Activity size={15} aria-hidden="true" /></span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-slate-900">{auditEventName(event.eventType)}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{auditObjectName(event.aggregateType)} · <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString("zh-CN")}</time></p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="px-6 py-8 text-sm text-slate-600">目前没有可显示的最近审计记录。</p>
              ) : (
                <div className="space-y-2 px-6 py-7">
                  <p className="text-sm font-medium text-slate-900">最近操作需要审计查看权限</p>
                  <p className="text-sm leading-6 text-slate-600">你的日常工作区仍可正常使用，查看审计记录无需取得发布或授权管理资格。</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="available-workspaces-heading" className="min-w-0">
          <Card className="gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white py-0 shadow-xs">
            <CardHeader className="space-y-1 border-b border-slate-100 px-6 py-5">
              <CardTitle id="available-workspaces-heading" className="text-base font-semibold">可用工作区</CardTitle>
              <CardDescription className="text-xs">其他已授权的工作入口</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {workspaces.length ? (
                <div className="divide-y divide-slate-100">
                  {workspaces.map((item) => (
                    <Link key={item.href} href={item.href as Route}
                      aria-label={item.href === "/admin/audit/evidence" ? "查看审计证据" : undefined}
                      className="group flex min-h-[70px] items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#176b5a]">
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-900">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                      </span>
                      <CircleArrowRight size={18} aria-hidden="true" className="shrink-0 text-slate-400 group-hover:text-[#176b5a]" />
                    </Link>
                  ))}
                </div>
              ) : <p className="px-6 py-8 text-sm text-slate-600">所有已授权的任务入口都已显示在上方。</p>}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
