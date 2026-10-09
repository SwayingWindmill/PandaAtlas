"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Clock3, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { curationListQueryOptions } from "@/features/admin/curation/api/queries";
import { reviewQueueQueryOptions } from "@/features/admin/review-moderation/api/queries";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { visibleAdminNavigationItems } from "@/features/admin/shell/navigation";

function QueueCount({ total, loading, error }: { total?: number; loading: boolean; error: boolean }) {
  if (error) return <span className="text-base font-medium">暂时无法读取</span>;
  if (loading) return <span className="text-base font-medium">正在读取…</span>;
  return <span className="text-5xl font-semibold tracking-tight tabular-nums">{total}</span>;
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
    <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-9 md:px-10 md:pt-12">
      <header className="mb-10 border-b border-slate-200 pb-8">
        <p className="mb-3 text-xs font-semibold tracking-[.16em] text-teal-800">PANDAATLAS / 数据运营</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">数据运营工作台</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          从待处理的审核与档案变更开始。每条记录都需要核实来源，才能进入下一步。
        </p>
      </header>

      {session.capabilities.includes("admin.shell.access") && session.aal !== "aal2" && (
        <aside className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-950">敏感操作需要双重验证。完成验证后才能继续审批或管理角色。</p>
          <Link href="/admin/security/mfa" className="text-sm font-semibold text-amber-950 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">前往账号安全设置</Link>
        </aside>
      )}

      <section aria-label="待处理的工作" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[.14em] text-slate-600">重点事项</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">待处理的工作</h2>
          </div>
          {(canReview || canCurate) && <span className="inline-flex items-center gap-2 text-sm text-slate-600"><Clock3 size={16} aria-hidden="true" />显示当前队列，不是今日新增量</span>}
        </div>

        {canReview || canCurate ? (
          <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            {canReview && (
              <article className="flex min-h-64 flex-col justify-between rounded-2xl bg-slate-900 p-7 text-white md:p-8">
                <div>
                  <p className="text-sm font-medium text-teal-200">01 / 资料审核</p>
                  <h3 className="mt-4 text-xl font-semibold">待分派审核案件</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">先核对提交材料与来源，由有权限的审核员领取后继续核验。</p>
                </div>
                <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                  <div aria-live="polite" className="text-white">
                    <QueueCount total={review.data?.total} loading={review.isPending} error={review.isError} />
                    <p className="mt-1 text-xs text-slate-300">{review.isError ? "可以进入队列检查并重试" : review.data?.total === 0 ? "目前没有新提交的案件" : "状态：新提交"}</p>
                  </div>
                  <Link href="/admin/reviews?state=new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-200 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                    进入审核队列 <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            )}

            {canCurate && (
              <article className={`flex min-h-64 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 shadow-sm md:p-8 ${!canReview ? "xl:col-span-2" : ""}`}>
                <div>
                  <p className="text-sm font-medium text-teal-800">{canReview ? "02" : "01"} / 档案策展</p>
                  <h3 className="mt-4 text-xl font-semibold text-slate-950">等待独立审批的变更</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">来源已核验，等待另一位具备审批权限的工作人员复核。</p>
                </div>
                <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                  <div aria-live="polite" className="text-slate-950">
                    <QueueCount total={curation.data?.total} loading={curation.isPending} error={curation.isError} />
                    <p className="mt-1 text-xs text-slate-600">{curation.isError ? "可以进入策展页面检查并重试" : curation.data?.total === 0 ? "目前没有等待审批的变更" : "状态：已核验"}</p>
                  </div>
                  <Link href="/admin/curation?state=validated" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:border-teal-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
                    进入策展变更 <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8">
            <p className="text-base font-medium text-slate-950">当前没有可在首页处理的任务队列。</p>
            <p className="mt-2 text-sm text-slate-600">你仍可以使用下方已授权的工作区。新增岗位权限后，待处理工作会自动出现。</p>
          </div>
        )}
      </section>

      <section aria-labelledby="available-workspaces-heading" className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="available-workspaces-heading" className="text-xl font-semibold tracking-tight text-slate-950">可用工作区</h2>
            <p className="mt-1 text-sm text-slate-600">其他工作入口。上方两条队列已列出，不在这里重复展示。</p>
          </div>
          <Link href="/admin/capabilities" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">查看我的权限 <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
        {workspaces.length ? (
          <div className="grid gap-x-8 border-y border-slate-200 md:grid-cols-2">
            {workspaces.map((item) => (
              <Link key={item.href} href={item.href as Route} aria-label={item.href === "/admin/audit/evidence" ? "查看审计证据" : undefined} className="group flex min-h-24 items-center justify-between gap-4 border-b border-slate-200 px-2 py-5 transition-colors hover:bg-slate-100/70 focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700">
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-slate-900">{item.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">{item.description}</span>
                </span>
                <ArrowUpRight className="shrink-0 text-slate-400 group-hover:text-teal-800" size={19} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="border-t border-slate-200 py-6 text-sm text-slate-600">所有可访问的业务队列已在上方列出。</p>
        )}
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2"><ShieldCheck size={17} aria-hidden="true" />所有操作均由服务端验证工作人员权限。</span>
        {session.capabilities.includes("admin.shell.access") && <Link href="/admin/security/mfa" className="text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">账号安全设置</Link>}
      </footer>
    </div>
  );
}
