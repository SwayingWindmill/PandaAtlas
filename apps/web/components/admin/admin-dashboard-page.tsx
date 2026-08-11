"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { adminContentFetch } from "@/components/admin/admin-content-client";
import type { AdminContentDashboardRead } from "@/components/admin/admin-content-types";

const quickActions = [
  { to: "/pandas/new", label: "+ 新增熊猫" },
  { to: "/locations", label: "+ 新增地点" },
  { to: "/sources", label: "+ 新增来源" },
  { to: "/events", label: "+ 新增事件" },
] as const;

function metricCard(label: string, value: number, to?: string) {
  const body = (
    <div className="rounded-xl border border-stone-300 bg-white p-5">
      <p className="text-sm font-semibold text-stone-600">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-stone-950">{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminContentDashboardRead | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminContentFetch<AdminContentDashboardRead>("dashboard")
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "无法读取后台概览。");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">ZhiPanda Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">概览</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            优先处理资料缺口、待审核内容和最近变更。公共内容仍通过 Change Set、校验与发布链进入前台。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="inline-flex min-h-11 items-center rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-stone-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">
          {error}
        </p>
      ) : null}
      {!dashboard && !error ? (
        <p className="mt-8 text-sm text-stone-600" role="status">正在读取后台概览…</p>
      ) : null}

      {dashboard ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="熊猫内容概览">
            {metricCard("熊猫总数", dashboard.panda_total, "/pandas")}
            {metricCard("已发布", dashboard.panda_published, "/pandas?publication_state=published")}
            {metricCard("草稿", dashboard.panda_draft, "/pandas?publication_state=draft")}
            {metricCard("资料不完整", dashboard.panda_incomplete, "/pandas?issue=incomplete")}
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
            <div className="rounded-xl border border-stone-300 bg-white p-5">
              <h2 className="text-xl font-bold text-stone-950">数据异常</h2>
              <p className="mt-1 text-sm text-stone-600">直接进入待处理熊猫，而不是只看统计。</p>
              <div className="mt-4 grid gap-2">
                {dashboard.issues.map((issue) => (
                  <Link
                    key={issue.code}
                    to={issue.href}
                    className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-stone-200 px-4 py-3 hover:border-stone-400"
                  >
                    <span className="font-semibold text-stone-900">{issue.label}</span>
                    <strong className="tabular-nums text-stone-950">{issue.count}</strong>
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {metricCard("待核实图片版权", dashboard.pending_media, "/images")}
              {metricCard("近 30 天新增来源", dashboard.recent_sources, "/sources")}
            </div>
          </section>

          <section className="mt-8 rounded-xl border border-stone-300 bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-stone-950">最近修改</h2>
                <p className="mt-1 text-sm text-stone-600">来自统一审计链的最近治理活动。</p>
              </div>
              <Link to="/audit-logs" className="text-sm font-semibold text-stone-800 underline underline-offset-4">
                查看全部审计
              </Link>
            </div>
            {dashboard.recent_activity.length ? (
              <ul className="mt-4 divide-y divide-stone-200">
                {dashboard.recent_activity.map((activity) => (
                  <li key={`${activity.action}-${activity.object_id}-${activity.occurred_at}`} className="grid gap-1 py-3 sm:grid-cols-[minmax(10rem,1fr)_2fr_auto] sm:items-center sm:gap-4">
                    <span className="text-sm font-semibold text-stone-900">{activity.actor}</span>
                    <span className="text-sm text-stone-700">{activity.action} · {activity.object_type}:{activity.object_id}</span>
                    <time className="text-xs text-stone-500" dateTime={activity.occurred_at}>
                      {new Date(activity.occurred_at).toLocaleString("zh-CN")}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-stone-600">暂无最近活动。</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
