"use client";

import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { adminContentFetch } from "@/components/admin/admin-content-client";
import type { AdminCenterDomain, AdminCenterRead } from "@/components/admin/admin-content-types";

const centerCopy: Record<
  AdminCenterDomain,
  { title: string; description: string; search: string; issueLabel: string }
> = {
  locations: {
    title: "地点与机构",
    description: "统一查看公开 Location / Facility / Institution 记录，优先暴露缺少名称或国家信息的异常。",
    search: "搜索地点、机构、ID…",
    issueLabel: "只看地点异常",
  },
  relationships: {
    title: "家谱关系",
    description: "统一查看已发布和进行中 Change Set 的父母关系；争议关系与无来源关系优先排在前面。",
    search: "搜索熊猫、父母关系、ID…",
    issueLabel: "只看关系异常",
  },
  events: {
    title: "事件中心",
    description: "统一查看 Panda Event；Calendar 与 Moments 继续消费同一事件真相。",
    search: "搜索熊猫、事件类型、日期、ID…",
    issueLabel: "只看事件异常",
  },
  images: {
    title: "图片与媒体",
    description: "统一查看可公开媒体及其版权、来源和 derivative 完整性。",
    search: "搜索熊猫、署名、媒体 ID…",
    issueLabel: "只看媒体异常",
  },
  sources: {
    title: "资料来源",
    description: "统一查看 Evidence Source 的发布机构、URL、访问状态和可靠度。",
    search: "搜索来源标题、发布机构、URL、ID…",
    issueLabel: "只看来源异常",
  },
  users: {
    title: "用户与账号",
    description: "统一查看 Identity Account、账号状态和当前角色；敏感操作继续进入 Moderation / Capability 专用工作台。",
    search: "搜索邮箱、账号 ID、角色…",
    issueLabel: "只看账号异常",
  },
};

const issueLabels: Record<string, string> = {
  missing_country: "缺少国家信息",
  missing_name: "缺少名称",
  missing_source: "缺少来源",
  disputed: "存在争议",
  unknown_date_precision: "日期精度未知",
  unknown_rights: "版权状态未知",
  missing_derivative: "缺少公开 derivative",
  source_access_issue: "来源访问异常",
  unverified_source: "来源尚未验证",
  no_role: "账号无角色",
  account_suspended: "账号已暂停",
  account_deleting: "账号删除处理中",
  account_deleted: "账号已删除",
};

export function AdminDomainCenterPage({ domain }: { domain: AdminCenterDomain }) {
  const copy = centerCopy[domain];
  const [data, setData] = useState<AdminCenterRead | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [issueOnly, setIssueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      page_size: "20",
      issue_only: issueOnly ? "true" : "false",
    });
    if (submittedQuery) params.set("q", submittedQuery);
    adminContentFetch<AdminCenterRead>(`centers/${domain}?${params.toString()}`)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "无法读取后台领域列表。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [domain, issueOnly, page, submittedQuery]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Content operations</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">{copy.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-650">{copy.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-stone-300 bg-white px-4 py-3">
            <span className="block text-xs text-stone-500">当前结果</span>
            <strong className="text-xl text-stone-950">{data?.total ?? "—"}</strong>
          </div>
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <span className="block text-xs text-amber-800">异常总数</span>
            <strong className="text-xl text-amber-950">{data?.issue_count ?? "—"}</strong>
          </div>
        </div>
      </header>

      <form onSubmit={submit} className="mt-7 grid gap-3 rounded-xl border border-stone-300 bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="text-sm font-semibold text-stone-800">
          搜索
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800">
          <input
            type="checkbox"
            checked={issueOnly}
            onChange={(event) => {
              setIssueOnly(event.target.checked);
              setPage(1);
            }}
          />
          {copy.issueLabel}
        </label>
        <button type="submit" className="min-h-11 self-end rounded-md bg-stone-950 px-5 font-semibold text-white">
          搜索
        </button>
      </form>

      {error ? (
        <p role="alert" className="mt-5 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950">
          {error}
        </p>
      ) : null}

      {!data && !error ? <p role="status" className="mt-6 text-sm text-stone-600">正在读取…</p> : null}

      {data ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-stone-300 bg-white">
          {data.items.length ? (
            <ul className="divide-y divide-stone-200">
              {data.items.map((item) => (
                <li key={`${item.entity_type}-${item.id}`} className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="break-words text-stone-950">{item.title}</strong>
                      <span className="rounded-full border border-stone-300 px-2 py-0.5 text-xs font-semibold text-stone-600">
                        {item.entity_type}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-stone-600">{item.subtitle ?? item.id}</p>
                    {item.issue_codes.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.issue_codes.map((issue) => (
                          <span key={issue} className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">
                            {issueLabels[issue] ?? issue}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="mt-2 inline-block text-xs font-semibold text-emerald-800">无已知异常</span>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="block text-xs text-stone-500">状态</span>
                    <strong>{item.state}</strong>
                    {item.updated_at ? <span className="mt-1 block text-xs text-stone-500">{new Date(item.updated_at).toLocaleString()}</span> : null}
                  </div>
                  {item.href ? (
                    <Link to={item.href} className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-500 px-3 text-sm font-semibold text-stone-900">
                      打开处理
                    </Link>
                  ) : (
                    <span className="text-xs text-stone-500">无直接操作</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-stone-600">当前筛选条件下没有记录。</p>
          )}
        </section>
      ) : null}

      {data ? (
        <div className="mt-5 flex items-center justify-between gap-4 text-sm">
          <span className="text-stone-600">第 {page} / {totalPages} 页</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-10 rounded-md border border-stone-400 px-4 font-semibold disabled:opacity-40">上一页</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="min-h-10 rounded-md border border-stone-400 px-4 font-semibold disabled:opacity-40">下一页</button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
