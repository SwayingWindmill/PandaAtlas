"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CheckCheck, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { visibleAdminNavigationItems } from "@/features/admin/shell/navigation";

export function AdminOverview() {
  const { data: session } = useQuery(adminSessionQueryOptions);
  if (!session) return null;

  const operations = visibleAdminNavigationItems(session).filter(
    (item) => item.href !== "/admin" && item.href !== "/admin/capabilities",
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-[.16em] text-teal-700">PANDAATLAS · 数据管理</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">数据运营工作台</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          从采集与审核到档案策展、版本发布和证据追溯。选择已授权的工作区，完成一条可核验的数据处理流程。
        </p>
      </div>

      <section aria-label="当前会话" className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="rounded-xl bg-teal-50 p-3 text-teal-700"><ShieldCheck size={23} /></span>
          <div className="min-w-0">
            <p className="text-sm text-slate-600">当前工作人员</p>
            <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">{session.accountId}</p>
            <p className="mt-2 text-xs text-slate-600">身份保证级别：{session.aal}</p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="rounded-xl bg-sky-50 p-3 text-sky-700"><CheckCheck size={23} /></span>
          <div>
            <p className="text-sm text-slate-600">可进入的业务工作区</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{operations.length}</p>
            <p className="mt-1 text-xs text-slate-600">根据当前账号的能力动态展示，不代表后台授权结果</p>
          </div>
        </div>
      </section>

      {session.capabilities.includes("admin.shell.access") && session.aal !== "aal2" ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-950">当前会话尚未通过多因素认证。敏感操作需要 AAL2 身份验证。</p>
          <Link href="/admin/security/mfa" className="text-sm font-semibold text-amber-950 underline underline-offset-2">
            前往账号安全设置
          </Link>
        </div>
      ) : null}

      <section aria-labelledby="available-workspaces-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="available-workspaces-heading" className="text-xl font-bold tracking-tight text-slate-900">可用工作区</h2>
            <p className="mt-1 text-sm text-slate-600">根据职责选择操作入口，所有变更由服务端再次校验权限。</p>
          </div>
          <Link href="/admin/capabilities" className="text-sm font-semibold text-teal-800 hover:underline">查看我的权限 <ArrowUpRight size={15} className="inline" /></Link>
        </div>
        {operations.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {operations.map((item, index) => (
              <Link
                key={item.href}
                href={item.href as Route}
                className="group flex min-h-44 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold tabular-nums tracking-widest text-slate-600">工作区 {String(index + 1).padStart(2, "0")}</span>
                  <ArrowUpRight size={18} className="text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-teal-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
            当前账号尚未分配业务操作权限，请联系管理员。
          </div>
        )}
      </section>
    </div>
  );
}
