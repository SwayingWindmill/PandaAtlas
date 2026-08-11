"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

interface GuessQuestionAdminItem {
  question_id: string;
  panda_id: string;
  panda_name: string;
  panda_slug: string;
  media_id: string;
  image_url: string | null;
  difficulty: "easy" | "medium" | "hard";
  option_panda_ids: string[];
  option_names: string[];
  recognition_tips: string[];
  state: "draft" | "published" | "disabled";
  attempt_count: number;
  correct_count: number;
  accuracy: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface GuessQuestionList {
  items: GuessQuestionAdminItem[];
  total: number;
  page: number;
  page_size: number;
}

async function adminGameFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/games/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = `Admin games request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") detail = payload.detail;
      else if (payload.detail) detail = JSON.stringify(payload.detail);
    } catch {
      // Keep stable fallback.
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

interface QuestionFormState {
  panda_id: string;
  media_id: string;
  difficulty: "easy" | "medium" | "hard";
  options: string[];
  tips: string;
}

const emptyForm: QuestionFormState = {
  panda_id: "",
  media_id: "",
  difficulty: "medium",
  options: ["", "", "", ""],
  tips: "",
};

export function AdminGuessQuestionBankPage() {
  const [data, setData] = useState<GuessQuestionList | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (submittedQuery) params.set("q", submittedQuery);
    if (stateFilter) params.set("state", stateFilter);
    if (difficultyFilter) params.set("difficulty", difficultyFilter);
    try {
      setData(await adminGameFetch<GuessQuestionList>(`guess/questions?${params.toString()}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取 Guess Panda 题库。");
    }
  }, [difficultyFilter, page, stateFilter, submittedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  }

  function setOption(index: number, value: string) {
    setForm((current) => ({
      ...current,
      options: current.options.map((item, itemIndex) => itemIndex === index ? value : item),
    }));
  }

  function edit(item: GuessQuestionAdminItem) {
    setEditingId(item.question_id);
    setForm({
      panda_id: item.panda_id,
      media_id: item.media_id,
      difficulty: item.difficulty,
      options: [...item.option_panda_ids],
      tips: item.recognition_tips.join("\n"),
    });
    setNotice(`正在编辑 ${item.panda_name} 的题目。保存后会回到 draft，需要重新发布。`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetEditor() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        panda_id: form.panda_id.trim(),
        media_id: form.media_id.trim(),
        difficulty: form.difficulty,
        option_panda_ids: form.options.map((item) => item.trim()),
        recognition_tips: form.tips.split("\n").map((item) => item.trim()).filter(Boolean),
      };
      if (editingId) {
        await adminGameFetch(`guess/questions/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setNotice("题目已更新为草稿，请检查后重新发布。");
      } else {
        await adminGameFetch("guess/questions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setNotice("题目草稿已创建。发布前会再次检查 Panda 与媒体是否仍在当前 Public Release。 ");
      }
      resetEditor();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存题目失败。");
    } finally {
      setWorking(false);
    }
  }

  async function command(item: GuessQuestionAdminItem, action: "publish" | "disable") {
    const verb = action === "publish" ? "发布" : "禁用";
    if (!window.confirm(`确认${verb}“${item.panda_name}”这道题？`)) return;
    setWorking(true);
    setError(null);
    try {
      await adminGameFetch(`guess/questions/${item.question_id}/${action}`, { method: "POST" });
      setNotice(action === "publish" ? "题目已发布，可被前台随机抽取。" : "题目已禁用，不再提供给前台。 ");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${verb}题目失败。`);
    } finally {
      setWorking(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Game content</p>
        <h1 className="mt-1 text-3xl font-bold text-stone-950">Guess Panda 题库</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-650">
          题目只保存 Panda ID、公开媒体 ID、四个选项和识别提示。名称、slug、图片 URL 始终从当前 Public Release 解析，不复制第二份熊猫资料。
        </p>
      </header>

      {error ? <p role="alert" className="mt-5 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950">{error}</p> : null}
      {notice ? <p role="status" className="mt-5 rounded-lg border border-emerald-700 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p> : null}

      <section className="mt-7 rounded-xl border border-stone-300 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{editingId ? "编辑题目" : "新建题目"}</h2>
            <p className="mt-1 text-sm text-stone-600">只能引用当前已发布 Panda 和该 Panda 的 available 公共媒体。</p>
          </div>
          {editingId ? <button type="button" onClick={resetEditor} className="min-h-10 rounded-md border border-stone-400 px-3 text-sm font-semibold">取消编辑</button> : null}
        </div>
        <form onSubmit={saveQuestion} className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="text-sm font-semibold text-stone-800">正确 Panda ID *<input required value={form.panda_id} onChange={(event) => setForm((current) => ({ ...current, panda_id: event.target.value }))} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-mono font-normal" /></label>
          <label className="text-sm font-semibold text-stone-800">公开 Media ID *<input required value={form.media_id} onChange={(event) => setForm((current) => ({ ...current, media_id: event.target.value }))} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-mono font-normal" /></label>
          <label className="text-sm font-semibold text-stone-800">难度<select value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value as typeof current.difficulty }))} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></select></label>
          <p className="self-end pb-3 text-sm text-stone-600">四个选项必须互不重复，并包含正确 Panda。</p>
          {form.options.map((value, index) => <label key={index} className="text-sm font-semibold text-stone-800">选项 {index + 1} Panda ID *<input required value={value} onChange={(event) => setOption(index, event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-mono font-normal" /></label>)}
          <label className="lg:col-span-2 text-sm font-semibold text-stone-800">识别提示（每行一条）<textarea rows={4} value={form.tips} onChange={(event) => setForm((current) => ({ ...current, tips: event.target.value }))} className="mt-1 w-full rounded-md border border-stone-400 p-3 font-normal" /></label>
          <div className="lg:col-span-2"><button type="submit" disabled={working} className="min-h-11 rounded-md bg-stone-950 px-5 font-semibold text-white disabled:opacity-40">{working ? "正在保存…" : editingId ? "保存修改" : "创建题目草稿"}</button></div>
        </form>
      </section>

      <form onSubmit={submitSearch} className="mt-7 grid gap-3 rounded-xl border border-stone-300 bg-white p-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
        <label className="text-sm font-semibold text-stone-800">搜索<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Panda 名称、slug、媒体 ID、Question ID" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal" /></label>
        <label className="text-sm font-semibold text-stone-800">状态<select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setPage(1); }} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="">全部</option><option value="draft">draft</option><option value="published">published</option><option value="disabled">disabled</option></select></label>
        <label className="text-sm font-semibold text-stone-800">难度<select value={difficultyFilter} onChange={(event) => { setDifficultyFilter(event.target.value); setPage(1); }} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="">全部</option><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></select></label>
        <button type="submit" className="min-h-11 self-end rounded-md bg-stone-950 px-5 font-semibold text-white">搜索</button>
      </form>

      <section className="mt-6 overflow-hidden rounded-xl border border-stone-300 bg-white">
        {data?.items.length ? <ul className="divide-y divide-stone-200">{data.items.map((item) => <li key={item.question_id} className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_15rem_13rem_auto] xl:items-center"><div><div className="flex flex-wrap items-center gap-2"><strong>{item.panda_name}</strong><span className="rounded-full border border-stone-300 px-2 py-0.5 text-xs font-semibold">{item.state}</span><span className="rounded-full border border-stone-300 px-2 py-0.5 text-xs font-semibold">{item.difficulty}</span></div><p className="mt-1 break-all text-xs text-stone-600">{item.question_id}</p><p className="mt-2 text-sm text-stone-600">选项：{item.option_names.join(" / ")}</p><p className="mt-1 text-xs text-stone-500">Media: {item.media_id}</p></div><div className="text-sm"><span className="block text-xs text-stone-500">成绩</span><strong>{item.correct_count} / {item.attempt_count}</strong><span className="mt-1 block text-xs text-stone-500">正确率 {item.accuracy === null ? "—" : `${Math.round(item.accuracy * 100)}%`}</span></div><div className="text-sm"><span className="block text-xs text-stone-500">更新</span>{new Date(item.updated_at).toLocaleString()}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={working || item.state === "disabled"} onClick={() => edit(item)} className="min-h-10 rounded-md border border-stone-400 px-3 text-sm font-semibold disabled:opacity-40">编辑</button>{item.state !== "published" && item.state !== "disabled" ? <button type="button" disabled={working} onClick={() => void command(item, "publish")} className="min-h-10 rounded-md bg-stone-950 px-3 text-sm font-semibold text-white disabled:opacity-40">发布</button> : null}{item.state !== "disabled" ? <button type="button" disabled={working} onClick={() => void command(item, "disable")} className="min-h-10 rounded-md border border-red-700 px-3 text-sm font-semibold text-red-900 disabled:opacity-40">禁用</button> : null}</div></li>)}</ul> : <p className="p-8 text-center text-sm text-stone-600">当前没有题目。</p>}
      </section>

      {data ? <div className="mt-5 flex items-center justify-between text-sm"><span>共 {data.total} 题 · 第 {page} / {totalPages} 页</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-10 rounded-md border border-stone-400 px-4 font-semibold disabled:opacity-40">上一页</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="min-h-10 rounded-md border border-stone-400 px-4 font-semibold disabled:opacity-40">下一页</button></div></div> : null}
    </main>
  );
}
