"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, ClipboardCheck, Database, LockKeyhole } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { auditEvidenceQueryOptions } from "@/features/admin/audit/api/queries";
import { auditEventName, auditObjectName } from "@/features/admin/audit/presentation";
import { curationListQueryOptions } from "@/features/admin/curation/api/queries";
import { reviewQueueQueryOptions } from "@/features/admin/review-moderation/api/queries";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { visibleAdminNavigationItems } from "@/features/admin/shell/navigation";

function QueueValue({ count, loading, error }: { count?: number; loading: boolean; error: boolean }) {
  if (error) return <span role="status" className="text-sm font-medium text-rose-700">暂时无法读取</span>;
  if (loading) return <Skeleton aria-label="正在读取队列" className="h-6 w-14 bg-slate-200" />;
  return (
    <span className="flex items-baseline gap-1 text-slate-950">
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{count}</span>
      <span className="text-xs text-slate-600">项</span>
    </span>
  );
}

export function AdminOverview() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  const canReview = session?.capabilities.includes("review.case.read") ?? false;
  const canCurate = session?.capabilities.includes("curation.change.read") ?? false;
  const canAudit = session?.capabilities.includes("audit.read") ?? false;
  const review = useQuery({
    ...reviewQueueQueryOptions({ state: "new", limit: 1, offset: 0 }),
    enabled: canReview,
    retry: false,
  });
  const curation = useQuery({
    ...curationListQueryOptions({ state: "validated", limit: 1, offset: 0 }),
    enabled: canCurate,
    retry: false,
  });
  const audit = useQuery({ ...auditEvidenceQueryOptions(5), enabled: canAudit, retry: false });

  if (!session) return null;

  const workspaces = visibleAdminNavigationItems(session).filter((item) => ![
    "/admin", "/admin/capabilities", "/admin/security/mfa",
    ...(canReview ? ["/admin/reviews"] : []),
    ...(canCurate ? ["/admin/curation"] : []),
  ].includes(item.href));

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-5 pb-12 pt-7 md:px-8 md:pt-10">
      <header className="space-y-2 border-b border-slate-200 pb-7">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">数据运营工作台</h1>
        <p className="text-sm leading-6 text-slate-600">先处理需要回应的事项。这里显示当前队列，不代表今日新增。</p>
      </header>

      {session.capabilities.includes("admin.shell.access") && session.aal !== "aal2" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-amber-950"><LockKeyhole size={17} aria-hidden="true" />敏感审批和账号授权需要完成双重验证，普通查看不受影响。</p>
          <Link href="/admin/security/mfa" className="text-sm font-semibold text-amber-950 underline underline-offset-4 focus-visible:outline-2">前往账号安全</Link>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(19rem,1fr)]">
        <section aria-label="待处理的工作" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">待处理的工作</h2>
            {(canReview || canCurate) && <span className="text-xs text-slate-600">当前队列 · 非今日新增</span>}
          </div>
          {canReview || canCurate ? (
            <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {canReview && (
                <Link href="/admin/reviews?state=new" aria-label="进入审核队列" className="group flex min-h-32 items-center gap-4 px-5 py-5 transition-colors hover:bg-teal-50/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700">
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><ClipboardCheck size={21} /></span>
                  <span className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-950">待分派审核案件</h3>
                    <p className="text-xs leading-5 text-slate-600">{review.isError ? "可以进入队列检查并重试" : review.data?.total === 0 ? "目前没有新提交的案件" : "新提交的材料等待领取和来源核验"}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800">进入审核队列 <ArrowRight size={14} aria-hidden="true" /></span>
                  </span>
                  <span className="min-w-16 text-right" aria-live="polite"><QueueValue count={review.data?.total} loading={review.isPending} error={review.isError} /></span>
                </Link>
              )}
              {canCurate && (
                <Link href="/admin/curation?state=validated" aria-label="进入策展变更" className="group flex min-h-32 items-center gap-4 px-5 py-5 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700">
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Database size={21} /></span>
                  <span className="min-w-0 flex-1 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-950">等待独立审批的变更</h3>
                    <p className="text-xs leading-5 text-slate-600">{curation.isError ? "可以进入策展页面检查并重试" : curation.data?.total === 0 ? "目前没有等待审批的变更" : "已核验的档案变更，等待独立审批"}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800">进入策展变更 <ArrowRight size={14} aria-hidden="true" /></span>
                  </span>
                  <span className="min-w-16 text-right" aria-live="polite"><QueueValue count={curation.data?.total} loading={curation.isPending} error={curation.isError} /></span>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-6">
              <p className="text-sm font-medium text-slate-900">当前没有可在首页处理的任务队列。</p>
              <p className="mt-2 text-sm text-slate-600">可以使用下方已授权的工作区，不需要额外的身份验证来查看已有记录。</p>
            </div>
          )}
        </section>

        <section aria-label="最近操作" className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">最近操作</h2>
            {canAudit && <Link href="/admin/audit/evidence" className="text-xs font-semibold text-teal-800 hover:underline">查看审计记录 <ArrowUpRight size={13} className="inline" aria-hidden="true" /></Link>}
          </div>
          <div className="min-h-40 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {canAudit ? (
              audit.isPending ? <p role="status" className="p-5 text-sm text-slate-600">正在读取最近操作…</p>
                : audit.isError ? <p role="status" className="p-5 text-sm text-slate-600">审计记录暂时不可用，可前往审计工作区查看。</p>
                  : audit.data?.length ? (
                    <ul className="divide-y divide-slate-100">
                      {audit.data.slice(0, 4).map((event) => (
                        <li key={event.sourceEventId} className="flex items-start gap-3 px-5 py-4">
                          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-teal-600 ring-4 ring-teal-50" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">{auditEventName(event.eventType)}</p>
                            <p className="mt-1 text-xs text-slate-600">{auditObjectName(event.aggregateType)} · <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString("zh-CN")}</time></p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="p-5 text-sm text-slate-600">目前没有可显示的最近审计记录。</p>
            ) : (
              <div className="space-y-2 p-5">
                <p className="text-sm font-medium text-slate-900">最近操作需要审计查看权限</p>
                <p className="text-sm leading-6 text-slate-600">你的日常工作区仍可正常使用，查看审计记录无需取得发布或授权管理资格。</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="available-workspaces-heading" className="space-y-4 border-t border-slate-200 pt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="available-workspaces-heading" className="text-lg font-semibold tracking-tight text-slate-950">可用工作区</h2>
            <p className="mt-1 text-xs text-slate-600">其他已授权的工作入口</p>
          </div>
          <Button asChild variant="outline" size="sm" className="min-h-9 border-slate-200 text-slate-800">
            <Link href="/admin/capabilities">查看我的权限 <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </Button>
        </div>
        {workspaces.length ? (
          <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-2">
            {workspaces.map((item) => (
              <Link key={item.href} href={item.href as Route}
                aria-label={item.href === "/admin/audit/evidence" ? "查看审计证据" : undefined}
                className="group flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700 md:border-r md:odd:border-r">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{item.description}</span>
                </span>
                <ArrowUpRight size={18} aria-hidden="true" className="shrink-0 text-slate-400 transition-colors group-hover:text-teal-800" />
              </Link>
            ))}
          </div>
        ) : <p className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">所有已授权的任务入口都已显示在上方。</p>}
      </section>

    </div>
  );
}
