"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, ClipboardCheck, Database, LockKeyhole, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { curationListQueryOptions } from "@/features/admin/curation/api/queries";
import { reviewQueueQueryOptions } from "@/features/admin/review-moderation/api/queries";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { visibleAdminNavigationItems } from "@/features/admin/shell/navigation";

function QueueCount({ total, loading, error }: { total?: number; loading: boolean; error: boolean }) {
  if (error) return <p className="text-sm font-medium text-rose-700" role="status">暂时无法读取</p>;
  if (loading) return <><Skeleton className="h-10 w-20 bg-slate-200" aria-hidden="true" /><span className="sr-only">正在读取队列</span></>;
  return <p className="text-4xl font-semibold tracking-tight tabular-nums text-slate-950">{total}</p>;
}

export function AdminOverview() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  const canReview = session?.capabilities.includes("review.case.read") ?? false;
  const canCurate = session?.capabilities.includes("curation.change.read") ?? false;
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

  if (!session) return null;

  const workspaces = visibleAdminNavigationItems(session).filter(
    (item) => !["/admin", "/admin/capabilities", "/admin/security/mfa",
      ...(canReview ? ["/admin/reviews"] : []),
      ...(canCurate ? ["/admin/curation"] : []),
    ].includes(item.href),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-5 pb-14 pt-7 md:px-8 md:pt-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">数据运营工作台</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">查看需要处理的审核与档案变更，快速进入相应工作区。</p>
        </div>
        <Badge variant="outline" className="mt-1 border-slate-200 bg-white px-3 py-1 text-slate-700">工作概览</Badge>
      </header>

      {session.capabilities.includes("admin.shell.access") && session.aal !== "aal2" && (
        <Card className="gap-2 border-amber-300 bg-amber-50 py-4 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-amber-950"><LockKeyhole size={17} aria-hidden="true" />敏感操作需要双重验证。完成验证后才能继续审批或管理角色。</p>
            <Button variant="outline" asChild className="min-h-10 border-amber-400 bg-white text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800">
              <Link href="/admin/security/mfa">前往账号安全设置 <ArrowRight size={16} aria-hidden="true" /></Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-label="待处理的工作" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-950">待处理的工作</h2>
          {(canReview || canCurate) && <Badge variant="secondary" className="border border-slate-200 bg-slate-100 font-normal text-slate-700">当前队列 · 非今日新增</Badge>}
        </div>

        {canReview || canCurate ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {canReview && (
              <Card className="gap-5 border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-slate-950"><ClipboardCheck size={19} className="text-teal-700" aria-hidden="true" />待分派审核案件</CardTitle>
                  <CardDescription className="max-w-sm leading-6 text-slate-600">新提交的材料等待领取与来源核验。</CardDescription>
                  <CardAction><Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">新提交</Badge></CardAction>
                </CardHeader>
                <CardContent aria-live="polite" className="space-y-1">
                  <QueueCount total={review.data?.total} loading={review.isPending} error={review.isError} />
                  <p className="text-xs text-slate-600">{review.isError ? "可以进入队列检查并重试" : review.data?.total === 0 ? "目前没有新提交的案件" : "审核队列中的新案件总数"}</p>
                </CardContent>
                <CardFooter className="border-t border-slate-100">
                  <Button asChild className="min-h-10 gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                    <Link href="/admin/reviews?state=new">进入审核队列 <ArrowRight size={16} aria-hidden="true" /></Link>
                  </Button>
                </CardFooter>
              </Card>
            )}

            {canCurate && (
              <Card className="gap-5 border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-slate-950"><Database size={19} className="text-teal-700" aria-hidden="true" />等待独立审批的变更</CardTitle>
                  <CardDescription className="max-w-sm leading-6 text-slate-600">变更已核验，等待另一位有权限的工作人员复核。</CardDescription>
                  <CardAction><Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">已核验</Badge></CardAction>
                </CardHeader>
                <CardContent aria-live="polite" className="space-y-1">
                  <QueueCount total={curation.data?.total} loading={curation.isPending} error={curation.isError} />
                  <p className="text-xs text-slate-600">{curation.isError ? "可以进入策展页面检查并重试" : curation.data?.total === 0 ? "目前没有等待审批的变更" : "策展队列中等待审批的变更总数"}</p>
                </CardContent>
                <CardFooter className="border-t border-slate-100">
                  <Button asChild variant="outline" className="min-h-10 gap-2 border-slate-300 text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                    <Link href="/admin/curation?state=validated">进入策展变更 <ArrowRight size={16} aria-hidden="true" /></Link>
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        ) : (
          <Card className="gap-2 border-slate-200 bg-white py-6 shadow-sm">
            <CardContent>
              <p className="text-sm font-medium text-slate-950">当前没有可在首页处理的任务队列。</p>
              <p className="mt-1 text-sm text-slate-600">你仍可以使用下方已授权的工作区。新增岗位权限后，待处理工作会自动出现。</p>
            </CardContent>
          </Card>
        )}
      </section>

      <section aria-labelledby="available-workspaces-heading">
        <Card className="gap-5 border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle id="available-workspaces-heading" className="text-lg text-slate-950">可用工作区</CardTitle>
            <CardDescription className="leading-6 text-slate-600">已授权的其他操作入口。待处理队列已在上方列出。</CardDescription>
            <CardAction>
              <Button variant="outline" asChild className="min-h-9 gap-1 border-slate-200 text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                <Link href="/admin/capabilities">我的权限 <ArrowUpRight size={15} aria-hidden="true" /></Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {workspaces.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {workspaces.map((item) => (
                  <Link key={item.href} href={item.href as Route} aria-label={item.href === "/admin/audit/evidence" ? "查看审计证据" : undefined} className="group flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3.5 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-950">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">{item.description}</span>
                    </span>
                    <ArrowUpRight size={17} aria-hidden="true" className="shrink-0 text-slate-500 group-hover:text-teal-800" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">所有可访问的业务队列已在上方列出。</p>
            )}
          </CardContent>
        </Card>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true" />所有操作均由服务端验证工作人员权限。</span>
        {session.capabilities.includes("admin.shell.access") && <Link href="/admin/security/mfa" className="text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">账号安全设置</Link>}
      </footer>
    </div>
  );
}
