"use client";

import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { adminContentFetch } from "@/components/admin/admin-content-client";

interface CreatedPanda {
  id: string;
  slug: string;
  name_zh: string;
}

export function AdminPandaCreatePage() {
  const navigate = useNavigate();
  const [nameZh, setNameZh] = useState("");
  const [slug, setSlug] = useState("");
  const [gender, setGender] = useState("unknown");
  const [birthDate, setBirthDate] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const created = await adminContentFetch<CreatedPanda>("pandas", {
        method: "POST",
        body: JSON.stringify({
          name_zh: nameZh.trim(),
          slug: slug.trim(),
          gender,
          birth_date: birthDate || null,
        }),
      });
      navigate(`/pandas/${created.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建熊猫草稿失败。");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link to="/pandas" className="text-sm font-semibold text-stone-700 underline underline-offset-4">
        返回熊猫列表
      </Link>
      <header className="mt-6">
        <p className="text-sm font-semibold text-stone-600">内容 · 熊猫</p>
        <h1 className="mt-1 text-3xl font-bold text-stone-950">新建熊猫草稿</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-700">
          第一步只建立稳定身份。创建后继续补充名称、家族、所在地、时间线、图片和来源，再运行发布检查。
        </p>
      </header>

      {error ? <p className="mt-6 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">{error}</p> : null}

      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-xl border border-stone-300 bg-white p-6">
        <label className="text-sm font-semibold text-stone-800">
          中文名 <span aria-hidden="true">*</span>
          <input
            required
            value={nameZh}
            onChange={(event) => setNameZh(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-stone-800">
          Slug <span aria-hidden="true">*</span>
          <input
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            placeholder="he-hua"
            className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-mono font-normal"
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">小写英文、数字和连字符，创建后作为稳定公开路径候选。</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-stone-800">
            性别
            <select value={gender} onChange={(event) => setGender(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal">
              <option value="unknown">未知</option>
              <option value="female">雌性</option>
              <option value="male">雄性</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-stone-800">
            出生日期（建议填写）
            <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal" />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-5">
          <button type="submit" disabled={working} className="min-h-11 rounded-md bg-stone-950 px-5 py-2 font-semibold text-white disabled:opacity-50">
            {working ? "正在创建…" : "创建草稿"}
          </button>
          <Link to="/pandas" className="inline-flex min-h-11 items-center rounded-md border border-stone-400 px-5 py-2 font-semibold text-stone-900">
            取消
          </Link>
        </div>
      </form>
    </main>
  );
}
