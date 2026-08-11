"use client";

import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { adminContentFetch } from "@/components/admin/admin-content-client";
import type { AdminPandaListRead } from "@/components/admin/admin-content-types";

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
    none: "无进行中修改",
    ready: "待发布",
    validation_failed: "检查未通过",
    publish_failed: "发布失败",
  };
  return labels[value] ?? value;
}

function qualityLabel(value: string) {
  return value === "verified" ? "已核实" : value === "likely" ? "较可信" : "待确认";
}

export function AdminPandaListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [data, setData] = useState<AdminPandaListRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    params.set("page_size", "20");
    adminContentFetch<AdminPandaListRead>(`pandas?${params.toString()}`)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "无法读取熊猫列表。");
      });
    return () => {
      active = false;
    };
  }, [page, searchParams]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    next.delete("page");
    setSearchParams(next);
  }

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">内容 · 熊猫</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">熊猫资料</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            搜索正式名、昵称、英文名或 slug；优先处理不完整和缺少来源的资料。
          </p>
        </div>
        <Link
          to="/pandas/new"
          className="inline-flex min-h-11 items-center rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
        >
          + 新增熊猫
        </Link>
      </header>

      <section className="mt-7 rounded-xl border border-stone-300 bg-white p-4" aria-label="熊猫筛选">
        <form className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(9rem,auto))_auto]" onSubmit={applySearch}>
          <label className="text-sm font-semibold text-stone-700">
            搜索
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="名称、昵称、英文名、slug"
              className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 text-stone-950"
            />
          </label>
          <label className="text-sm font-semibold text-stone-700">
            发布状态
            <select
              value={searchParams.get("publication_state") ?? ""}
              onChange={(event) => setFilter("publication_state", event.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3"
            >
              <option value="">全部</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-stone-700">
            数据质量
            <select
              value={searchParams.get("quality") ?? ""}
              onChange={(event) => setFilter("quality", event.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3"
            >
              <option value="">全部</option>
              <option value="verified">已核实</option>
              <option value="likely">较可信</option>
              <option value="uncertain">待确认</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-stone-700">
            资料问题
            <select
              value={searchParams.get("issue") ?? ""}
              onChange={(event) => setFilter("issue", event.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3"
            >
              <option value="">全部</option>
              <option value="incomplete">待完善</option>
              <option value="no-cover">无封面</option>
              <option value="no-source">无来源</option>
              <option value="no-location">无当前地点</option>
            </select>
          </label>
          <button className="min-h-11 self-end rounded-md border border-stone-500 px-4 text-sm font-semibold" type="submit">
            搜索
          </button>
        </form>
      </section>

      {error ? <p className="mt-6 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">{error}</p> : null}
      {!data && !error ? <p className="mt-8 text-sm text-stone-600" role="status">正在读取熊猫资料…</p> : null}

      {data ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-stone-300 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
              <thead className="bg-stone-100 text-stone-700">
                <tr>
                  <th className="px-4 py-3">熊猫</th>
                  <th className="px-4 py-3">性别</th>
                  <th className="px-4 py-3">出生日期</th>
                  <th className="px-4 py-3">当前所在地</th>
                  <th className="px-4 py-3">完整度</th>
                  <th className="px-4 py-3">数据质量</th>
                  <th className="px-4 py-3">发布</th>
                  <th className="px-4 py-3">进行中修改</th>
                  <th className="px-4 py-3">更新时间</th>
                  <th className="px-4 py-3">编辑人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {data.items.map((panda) => (
                  <tr key={panda.id} className="align-top hover:bg-stone-50">
                    <td className="px-4 py-4">
                      <Link to={`/pandas/${panda.id}`} className="font-bold text-stone-950 underline underline-offset-4">
                        {panda.name_zh}
                      </Link>
                      {panda.name_en ? <span className="mt-1 block text-xs text-stone-500">{panda.name_en}</span> : null}
                      <code className="mt-1 block text-xs text-stone-500">{panda.slug}</code>
                    </td>
                    <td className="px-4 py-4">{panda.gender}</td>
                    <td className="px-4 py-4">{panda.birth_date ?? "—"}</td>
                    <td className="px-4 py-4">{panda.current_location ?? "—"}</td>
                    <td className="px-4 py-4"><strong>{panda.completeness}%</strong></td>
                    <td className="px-4 py-4">{qualityLabel(panda.data_quality)}</td>
                    <td className="px-4 py-4">{statusLabel(panda.publication_state)}</td>
                    <td className="px-4 py-4">{statusLabel(panda.workflow_state)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{new Date(panda.updated_at).toLocaleDateString("zh-CN")}</td>
                    <td className="px-4 py-4 max-w-48 break-all">{panda.last_editor ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 text-sm">
            <span>共 {data.total} 只 · 第 {data.page}/{totalPages} 页</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setFilter("page", String(page - 1))}
                className="min-h-10 rounded-md border px-3 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setFilter("page", String(page + 1))}
                className="min-h-10 rounded-md border px-3 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </footer>
        </section>
      ) : null}
    </main>
  );
}
