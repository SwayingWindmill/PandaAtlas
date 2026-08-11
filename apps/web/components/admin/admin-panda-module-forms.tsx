"use client";

import { FormEvent, useState } from "react";

import { adminContentFetch } from "@/components/admin/admin-content-client";
import type { AdminPandaListRead } from "@/components/admin/admin-content-types";

interface ModuleFormProps {
  pandaId: string;
  disabled: boolean;
  onSaved: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
}

function sourceIds(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function postModule(
  pandaId: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await adminContentFetch(`pandas/${pandaId}/${path}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function SaveButton({ working, disabled, label }: { working: boolean; disabled: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={working || disabled}
      className="min-h-11 rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
    >
      {working ? "正在保存…" : label}
    </button>
  );
}

function Field({
  label,
  name,
  required = false,
  type = "text",
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm font-semibold text-stone-800">
      {label}
      <input
        name={name}
        required={required}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"
      />
    </label>
  );
}

function SourceField({ required = true }: { required?: boolean }) {
  return (
    <label className="text-sm font-semibold text-stone-800">
      来源 ID{required ? " *" : "（可选）"}
      <input
        name="source_ids"
        required={required}
        placeholder="src_example_1, src_example_2"
        className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-mono text-sm font-normal"
      />
      <span className="mt-1 block text-xs font-normal text-stone-500">
        多个来源用逗号分隔。可先在“来源”Tab 新建来源，再引用同一个 Change Set 中的新来源。
      </span>
    </label>
  );
}

export function NameCreateForm({ pandaId, disabled, onSaved, onError }: ModuleFormProps) {
  const [working, setWorking] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    try {
      await postModule(pandaId, "names", {
        value: String(form.get("value") ?? "").trim(),
        language_tag: String(form.get("language_tag") ?? "zh-CN"),
        name_kind: String(form.get("name_kind") ?? "nickname"),
        is_primary: form.get("is_primary") === "on",
        source_ids: sourceIds(form.get("source_ids")),
        reason: String(form.get("reason") ?? "Add Panda name from Admin").trim(),
      });
      event.currentTarget.reset();
      await onSaved("名称已加入当前 Change Set。公开站尚未变化。");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存名称失败。");
    } finally {
      setWorking(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
      <Field label="名称 *" name="value" required />
      <label className="text-sm font-semibold text-stone-800">语言<select name="language_tag" defaultValue="zh-CN" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="zh-CN">中文</option><option value="en">英文</option><option value="zh-Latn-pinyin">拼音</option></select></label>
      <label className="text-sm font-semibold text-stone-800">类型<select name="name_kind" defaultValue="nickname" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="official">正式名</option><option value="official_romanization">英文/罗马字正式名</option><option value="pinyin">拼音</option><option value="nickname">昵称</option><option value="alias">其他别名</option><option value="historical_name">曾用名</option><option value="historic_spelling">历史拼写</option></select></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-stone-800"><input type="checkbox" name="is_primary" />设为该语言主要名称</label>
      <SourceField required={false} />
      <Field label="修改理由 *" name="reason" required defaultValue="Add Panda name from Admin" />
      <div className="sm:col-span-2"><SaveButton working={working} disabled={disabled} label="保存名称" /></div>
    </form>
  );
}

export function ParentCreateForm({ pandaId, disabled, onSaved, onError }: ModuleFormProps) {
  const [working, setWorking] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<AdminPandaListRead["items"]>([]);
  const [selectedId, setSelectedId] = useState("");

  async function searchParent() {
    if (!query.trim()) return;
    try {
      const result = await adminContentFetch<AdminPandaListRead>(`pandas?q=${encodeURIComponent(query.trim())}&page_size=10`);
      setMatches(result.items.filter((item) => item.id !== pandaId));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "搜索 Panda 失败。");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) {
      onError("请先搜索并选择父母 Panda。");
      return;
    }
    const form = new FormData(event.currentTarget);
    setWorking(true);
    try {
      await postModule(pandaId, "parents", {
        role: String(form.get("role") ?? "father"),
        parent_id: selectedId,
        status: String(form.get("status") ?? "confirmed"),
        source_ids: sourceIds(form.get("source_ids")),
        reason: String(form.get("reason") ?? "Update parentage from Admin").trim(),
      });
      await onSaved("父母关系已加入当前 Change Set，并已通过 self/角色/循环预检。");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存父母关系失败。");
    } finally {
      setWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="text-sm font-semibold text-stone-800">搜索父母 Panda<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="正式名、昵称、英文名、slug" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal" /></label>
        <button type="button" onClick={() => void searchParent()} className="min-h-11 self-end rounded-md border border-stone-500 px-4 text-sm font-semibold">搜索</button>
      </div>
      {matches.length ? <div className="grid gap-2 sm:grid-cols-2">{matches.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`rounded-lg border p-3 text-left ${selectedId === item.id ? "border-stone-950 bg-white" : "border-stone-300"}`}><strong>{item.name_zh}</strong><span className="mt-1 block text-xs text-stone-600">{item.name_en ?? "无英文名"} · {item.birth_date?.slice(0, 4) ?? "出生年未知"} · {item.slug}</span></button>)}</div> : null}
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-stone-800">角色<select name="role" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="father">父亲</option><option value="mother">母亲</option></select></label><label className="text-sm font-semibold text-stone-800">可信状态<select name="status" defaultValue="confirmed" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="confirmed">确认</option><option value="tentative">暂定</option><option value="disputed">有争议</option></select></label></div>
      <SourceField />
      <Field label="修改理由 *" name="reason" required defaultValue="Update parentage from Admin" />
      <div><SaveButton working={working} disabled={disabled || !selectedId} label="保存家族关系" /></div>
    </form>
  );
}

export function ResidencyCreateForm({ pandaId, disabled, onSaved, onError }: ModuleFormProps) {
  const [working, setWorking] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    try {
      await postModule(pandaId, "residencies", {
        residency_type: String(form.get("residency_type") ?? "primary"),
        start_date: String(form.get("start_date")),
        start_precision: String(form.get("start_precision") ?? "day"),
        end_date: String(form.get("end_date") ?? "") || null,
        end_precision: String(form.get("end_precision") ?? "") || null,
        facility_id: null,
        coarse_location: String(form.get("coarse_location") ?? "").trim() || null,
        status: String(form.get("status") ?? "confirmed"),
        source_ids: sourceIds(form.get("source_ids")),
        reason: String(form.get("reason") ?? "Update Panda residency from Admin").trim(),
      });
      event.currentTarget.reset();
      await onSaved("所在地记录已加入当前 Change Set；新的 current primary 会自动关闭旧 current primary。");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存所在地失败。");
    } finally {
      setWorking(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
      <Field label="地点/机构名称（粗粒度） *" name="coarse_location" required placeholder="成都大熊猫繁育研究基地" />
      <label className="text-sm font-semibold text-stone-800">记录类型<select name="residency_type" defaultValue="primary" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="primary">主要所在地</option><option value="temporary">临时所在地</option><option value="transit">运输/中转</option><option value="quarantine">隔离</option></select></label>
      <Field label="开始日期 *" name="start_date" type="date" required />
      <PrecisionSelect label="开始日期精度" name="start_precision" />
      <Field label="结束日期" name="end_date" type="date" />
      <PrecisionSelect label="结束日期精度" name="end_precision" allowBlank />
      <label className="text-sm font-semibold text-stone-800">状态<select name="status" defaultValue="confirmed" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="confirmed">确认</option><option value="confirmed_country_level">仅国家层级确认</option><option value="provisional">暂定</option></select></label>
      <SourceField />
      <Field label="修改理由 *" name="reason" required defaultValue="Update Panda residency from Admin" />
      <div className="sm:col-span-2"><SaveButton working={working} disabled={disabled} label="保存所在地记录" /></div>
    </form>
  );
}

function PrecisionSelect({ label, name, allowBlank = false }: { label: string; name: string; allowBlank?: boolean }) {
  return <label className="text-sm font-semibold text-stone-800">{label}<select name={name} defaultValue={allowBlank ? "" : "day"} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal">{allowBlank ? <option value="">未设置</option> : null}<option value="day">精确到日</option><option value="month">精确到月</option><option value="year">精确到年</option><option value="unknown">未知</option></select></label>;
}

export function EventCreateForm({ pandaId, disabled, onSaved, onError }: ModuleFormProps) {
  const [working, setWorking] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    try {
      await postModule(pandaId, "events", {
        event_type: String(form.get("event_type") ?? "observation"),
        event_date: String(form.get("event_date")),
        event_date_precision: String(form.get("event_date_precision") ?? "day"),
        event_status: String(form.get("event_status") ?? "completed"),
        facility_id: null,
        coarse_location: String(form.get("coarse_location") ?? "").trim() || null,
        source_ids: sourceIds(form.get("source_ids")),
        reason: String(form.get("reason") ?? "Add Panda event from Admin").trim(),
      });
      event.currentTarget.reset();
      await onSaved("事件已加入当前 Change Set；Calendar 与 Moments 会复用同一事件真相。");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存事件失败。");
    } finally {
      setWorking(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-stone-800">事件类型<select name="event_type" defaultValue="observation" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal">{["birth","arrival","transfer","return","naming","public_debut","selection","announcement","observation","death"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="text-sm font-semibold text-stone-800">事件状态<select name="event_status" defaultValue="completed" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="completed">已发生</option><option value="announced">已宣布</option><option value="cancelled">取消</option><option value="disputed">有争议</option></select></label>
      <Field label="事件日期 *" name="event_date" type="date" required />
      <PrecisionSelect label="日期精度" name="event_date_precision" />
      <Field label="地点（可选）" name="coarse_location" />
      <SourceField />
      <Field label="修改理由 *" name="reason" required defaultValue="Add Panda event from Admin" />
      <div className="sm:col-span-2"><SaveButton working={working} disabled={disabled} label="保存事件" /></div>
    </form>
  );
}

export function SourceCreateForm({ pandaId, disabled, onSaved, onError }: ModuleFormProps) {
  const [working, setWorking] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    try {
      await postModule(pandaId, "sources", {
        source_id: String(form.get("source_id") ?? "").trim(),
        publisher: String(form.get("publisher") ?? "").trim(),
        title: String(form.get("title") ?? "").trim(),
        url: String(form.get("url") ?? "").trim(),
        published_at: String(form.get("published_at") ?? "") || null,
        last_verified_at: String(form.get("last_verified_at") ?? ""),
        language_tag: String(form.get("language_tag") ?? "zh-CN"),
        access_state: String(form.get("access_state") ?? "accessible"),
        evidence_tier: String(form.get("evidence_tier") ?? "unverified"),
        reason: String(form.get("reason") ?? "Add evidence source from Admin").trim(),
      });
      await onSaved("来源已加入当前 Change Set；相同 URL 会被去重检查拦截。");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存来源失败。");
    } finally {
      setWorking(false);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
      <Field label="来源 ID *" name="source_id" required placeholder="src_czoo_2026_hehua" />
      <Field label="发布机构 *" name="publisher" required />
      <Field label="标题 *" name="title" required />
      <Field label="URL *" name="url" type="url" required placeholder="https://…" />
      <Field label="发布日期" name="published_at" type="date" />
      <Field label="最后核实日期 *" name="last_verified_at" type="date" required defaultValue={today} />
      <label className="text-sm font-semibold text-stone-800">可靠度<select name="evidence_tier" defaultValue="unverified" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="primary">一手来源</option><option value="secondary">二手来源</option><option value="unverified">未验证</option></select></label>
      <label className="text-sm font-semibold text-stone-800">访问状态<select name="access_state" defaultValue="accessible" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="accessible">可访问</option><option value="redirected">重定向</option><option value="archived">已归档</option><option value="changed">内容变化</option><option value="unavailable">不可访问</option><option value="restricted">受限</option></select></label>
      <label className="text-sm font-semibold text-stone-800">语言<select name="language_tag" defaultValue="zh-CN" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="zh-CN">中文</option><option value="en">英文</option></select></label>
      <Field label="修改理由 *" name="reason" required defaultValue="Add evidence source from Admin" />
      <div className="sm:col-span-2"><SaveButton working={working} disabled={disabled} label="保存来源" /></div>
    </form>
  );
}

export function MediaCreateForm({ pandaId, disabled, onSaved, onError }: ModuleFormProps) {
  const [working, setWorking] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setWorking(true);
    try {
      await postModule(pandaId, "media", {
        media_id: String(form.get("media_id") ?? "").trim(),
        source_url: String(form.get("source_url") ?? "").trim(),
        url: String(form.get("url") ?? "").trim(),
        rights: String(form.get("rights") ?? "external_reference"),
        credit: String(form.get("credit") ?? "").trim(),
        alt_zh: String(form.get("alt_zh") ?? "").trim(),
        alt_en: String(form.get("alt_en") ?? "").trim(),
        source_ids: sourceIds(form.get("source_ids")),
        sha256: String(form.get("sha256") ?? "").trim(),
        mime_type: String(form.get("mime_type") ?? "image/jpeg"),
        width: Number(form.get("width")),
        height: Number(form.get("height")),
        byte_size: Number(form.get("byte_size")),
        derivative_url: String(form.get("derivative_url") ?? "").trim(),
        derivative_sha256: String(form.get("derivative_sha256") ?? "").trim(),
        derivative_width: Number(form.get("derivative_width")),
        derivative_height: Number(form.get("derivative_height")),
        is_cover: form.get("is_cover") === "on",
        reason: String(form.get("reason") ?? "Register approved Panda media from Admin").trim(),
      });
      await onSaved("媒体记录已加入当前 Change Set；版权状态必须明确后才允许发布。 ");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存图片记录失败。");
    } finally {
      setWorking(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-5 grid gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
      <p className="sm:col-span-2 text-sm text-stone-600">这里登记已经通过对象存储/媒体处理链得到的公开图片和 derivative。原始文件上传继续复用 Review 附件上传链，避免在浏览器建立第二套存储权限。</p>
      <Field label="Media ID *" name="media_id" required placeholder="media_hehua_2026_cover" />
      <Field label="原始来源 URL *" name="source_url" type="url" required />
      <Field label="公开图片 URL *" name="url" type="url" required />
      <Field label="Display derivative URL *" name="derivative_url" type="url" required />
      <label className="text-sm font-semibold text-stone-800">版权状态<select name="rights" defaultValue="external_reference" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="owned">自有</option><option value="licensed">已授权许可</option><option value="permission_granted">已获许可</option><option value="public_domain">公有领域</option><option value="external_reference">外部引用</option></select></label>
      <Field label="署名/摄影者 *" name="credit" required />
      <Field label="中文替代文本 *" name="alt_zh" required />
      <Field label="英文替代文本 *" name="alt_en" required />
      <SourceField />
      <label className="text-sm font-semibold text-stone-800">MIME<select name="mime_type" defaultValue="image/jpeg" className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal"><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>
      <Field label="原图 SHA-256 *" name="sha256" required placeholder="64 位十六进制" />
      <Field label="Derivative SHA-256 *" name="derivative_sha256" required placeholder="64 位十六进制" />
      <Field label="原图宽度 *" name="width" type="number" required />
      <Field label="原图高度 *" name="height" type="number" required />
      <Field label="文件字节数 *" name="byte_size" type="number" required />
      <Field label="Derivative 宽度 *" name="derivative_width" type="number" required />
      <Field label="Derivative 高度 *" name="derivative_height" type="number" required />
      <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input type="checkbox" name="is_cover" />设为封面</label>
      <Field label="修改理由 *" name="reason" required defaultValue="Register approved Panda media from Admin" />
      <div className="sm:col-span-2"><SaveButton working={working} disabled={disabled} label="保存图片记录" /></div>
    </form>
  );
}
