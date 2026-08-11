"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { adminContentFetch } from "@/components/admin/admin-content-client";
import { AdminPandaRawMediaUpload } from "@/components/admin/admin-panda-raw-media-upload";
import {
  EventCreateForm,
  MediaCreateForm,
  NameCreateForm,
  ParentCreateForm,
  ResidencyCreateForm,
  SourceCreateForm,
} from "@/components/admin/admin-panda-module-forms";
import type {
  AdminPandaDetailRead,
  AdminPandaValidationRead,
} from "@/components/admin/admin-content-types";

const tabs = [
  ["basic", "基本资料"],
  ["names", "名称"],
  ["family", "家族"],
  ["locations", "所在地"],
  ["events", "时间线"],
  ["images", "图片"],
  ["sources", "来源"],
  ["publish", "发布"],
] as const;

type TabKey = (typeof tabs)[number][0];

const issueLabels: Record<string, string> = {
  missing_cover: "缺少封面",
  missing_source: "暂无资料来源",
  missing_current_location: "当前所在地缺失",
  missing_parentage: "父母关系尚未录入",
  missing_birth_date: "出生日期缺失",
  unknown_media_license: "存在版权状态未知的图片",
  multiple_current_residencies: "存在多条当前主要所在地记录",
};

function text(value: string | null | undefined) {
  return value?.trim() || "—";
}

export function AdminPandaDetailPage() {
  const { pandaId } = useParams<{ pandaId: string }>();
  const [detail, setDetail] = useState<AdminPandaDetailRead | null>(null);
  const [tab, setTab] = useState<TabKey>("basic");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [validation, setValidation] = useState<AdminPandaValidationRead | null>(null);

  const load = useCallback(async () => {
    if (!pandaId) return;
    setError(null);
    try {
      setDetail(await adminContentFetch<AdminPandaDetailRead>(`pandas/${pandaId}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取熊猫资料。");
    }
  }, [pandaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEditDraft = detail
    ? detail.workflow.status === "none" || detail.workflow.status === "draft"
    : false;
  const previewHref = detail?.panda.publication_state === "published"
    ? `/zh/pandas/${detail.panda.slug}`
    : null;

  async function saveBasic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pandaId || !detail) return;
    const form = new FormData(event.currentTarget);
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await adminContentFetch(`pandas/${pandaId}/change-sets`, {
        method: "POST",
        body: JSON.stringify({
          name_zh: String(form.get("name_zh") ?? "").trim(),
          name_en: String(form.get("name_en") ?? "").trim() || null,
          slug: String(form.get("slug") ?? "").trim(),
          gender: String(form.get("gender") ?? "unknown"),
          birth_date: String(form.get("birth_date") ?? "") || null,
          death_date: String(form.get("death_date") ?? "") || null,
          status: String(form.get("status") ?? "unknown"),
          birthplace: String(form.get("birthplace") ?? "").trim() || null,
          current_location: detail.panda.current_location,
          intro: String(form.get("intro") ?? "").trim() || null,
          tags: String(form.get("tags") ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          is_featured: form.get("is_featured") === "on",
          reason: String(form.get("reason") ?? "").trim(),
        }),
      });
      setNotice("已保存为 Change Set。请在“发布”中运行检查；公开站尚未变化。");
      setTab("publish");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存基本资料失败。");
    } finally {
      setWorking(false);
    }
  }

  async function moduleSaved(message: string) {
    setError(null);
    setNotice(message);
    setValidation(null);
    await load();
  }

  function moduleError(message: string) {
    setNotice(null);
    setError(message);
  }

  async function validate() {
    if (!pandaId || !detail?.workflow.change_set_id) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const result = await adminContentFetch<AdminPandaValidationRead>(
        `pandas/${pandaId}/change-sets/${detail.workflow.change_set_id}/validate`,
        {
          method: "POST",
          body: JSON.stringify({ reason: "Run Panda publication checks from Admin" }),
        },
      );
      setValidation(result);
      setNotice(result.outcome === "ready" ? "发布检查通过，可以发布。" : "发布检查未通过，请先处理问题。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布检查失败。");
    } finally {
      setWorking(false);
    }
  }

  async function reopen() {
    if (!pandaId || !detail?.workflow.change_set_id) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await adminContentFetch(
        `pandas/${pandaId}/change-sets/${detail.workflow.change_set_id}/reopen`,
        {
          method: "POST",
          body: JSON.stringify({ reason: "Reopen failed Panda validation from Admin" }),
        },
      );
      setValidation(null);
      setNotice("已返回草稿，可继续修复资料后重新运行发布检查。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法重新打开 Change Set。");
    } finally {
      setWorking(false);
    }
  }

  async function publish() {
    if (!pandaId || !detail?.workflow.change_set_id) return;
    const name = detail.panda.name_zh;
    if (!window.confirm(`确认发布“${name}”当前 Change Set？发布后会进入权威 Archive Release。`)) {
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      await adminContentFetch(
        `pandas/${pandaId}/change-sets/${detail.workflow.change_set_id}/publish`,
        {
          method: "POST",
          body: JSON.stringify({ reason: `Publish Panda profile: ${name}` }),
        },
      );
      setValidation(null);
      setNotice("发布命令已完成；公开投影会按现有 Release 流程更新。 ");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "发布失败。");
    } finally {
      setWorking(false);
    }
  }

  if (!detail && !error) {
    return <p className="mx-auto max-w-7xl px-4 py-10 text-sm text-stone-600" role="status">正在读取熊猫资料…</p>;
  }
  if (!detail) {
    return <p className="mx-auto mt-10 max-w-4xl rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">{error}</p>;
  }

  return (
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8">
      <Link to="/pandas" className="text-sm font-semibold text-stone-700 underline underline-offset-4">返回熊猫列表</Link>

      <header className="sticky top-0 z-10 mt-5 rounded-xl border border-stone-300 bg-white/95 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Panda #{detail.panda.id.slice(0, 8)}</p>
            <h1 className="mt-1 text-3xl font-bold text-stone-950">{detail.panda.name_zh}</h1>
            <p className="mt-1 text-sm text-stone-600">{text(detail.panda.name_en)} · <code>{detail.panda.slug}</code></p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><span className="block text-xs text-stone-500">发布状态</span><strong>{detail.panda.publication_state === "published" ? "已发布" : "草稿"}</strong></div>
            <div><span className="block text-xs text-stone-500">数据完整度</span><strong>{detail.panda.completeness}%</strong></div>
            <div><span className="block text-xs text-stone-500">数据质量</span><strong>{detail.panda.data_quality}</strong></div>
            <div><span className="block text-xs text-stone-500">进行中修改</span><strong>{detail.workflow.status}</strong></div>
          </div>
          {previewHref ? (
            <a href={previewHref} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-md border border-stone-400 px-3 text-sm font-semibold">前台预览</a>
          ) : (
            <span className="text-xs text-stone-500">Draft 尚无公开预览</span>
          )}
        </div>
      </header>

      {error ? <p className="mt-5 rounded-lg border border-red-800 bg-red-50 p-4 text-sm text-red-950" role="alert">{error}</p> : null}
      {notice ? <p className="mt-5 rounded-lg border border-emerald-700 bg-emerald-50 p-4 text-sm text-emerald-950" role="status">{notice}</p> : null}

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-stone-300" aria-label="熊猫编辑模块">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold ${tab === key ? "border-stone-950 text-stone-950" : "border-transparent text-stone-600"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="py-6">
        {tab === "basic" ? <BasicTab detail={detail} disabled={!canEditDraft || working} onSubmit={saveBasic} /> : null}
        {tab === "names" ? <NamesTab detail={detail} pandaId={pandaId!} disabled={!canEditDraft} onSaved={moduleSaved} onError={moduleError} /> : null}
        {tab === "family" ? <FamilyTab detail={detail} pandaId={pandaId!} disabled={!canEditDraft} onSaved={moduleSaved} onError={moduleError} /> : null}
        {tab === "locations" ? <LocationsTab detail={detail} pandaId={pandaId!} disabled={!canEditDraft} onSaved={moduleSaved} onError={moduleError} /> : null}
        {tab === "events" ? <EventsTab detail={detail} pandaId={pandaId!} disabled={!canEditDraft} onSaved={moduleSaved} onError={moduleError} /> : null}
        {tab === "images" ? <ImagesTab detail={detail} pandaId={pandaId!} disabled={!canEditDraft} onSaved={moduleSaved} onError={moduleError} /> : null}
        {tab === "sources" ? <SourcesTab detail={detail} pandaId={pandaId!} disabled={!canEditDraft} onSaved={moduleSaved} onError={moduleError} /> : null}
        {tab === "publish" ? (
          <PublishTab
            detail={detail}
            validation={validation}
            working={working}
            onValidate={() => void validate()}
            onReopen={() => void reopen()}
            onPublish={() => void publish()}
          />
        ) : null}
      </div>
    </main>
  );
}

function BasicTab({ detail, disabled, onSubmit }: { detail: AdminPandaDetailRead; disabled: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-xl border border-stone-300 bg-white p-6 lg:grid-cols-2">
      {!disabled ? null : <p className="lg:col-span-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">当前 Change Set 已进入发布检查或发布阶段；如需继续修改，请先完成或重新打开该工作流。</p>}
      <Field label="中文正式名" name="name_zh" defaultValue={detail.panda.name_zh} required />
      <Field label="英文名" name="name_en" defaultValue={detail.panda.name_en ?? ""} />
      <Field label="Slug" name="slug" defaultValue={detail.panda.slug} required mono />
      <SelectField label="性别" name="gender" defaultValue={detail.panda.gender} options={["unknown", "female", "male"]} />
      <Field label="出生日期" name="birth_date" defaultValue={detail.panda.birth_date ?? ""} type="date" />
      <Field label="去世日期" name="death_date" defaultValue={detail.death_date ?? ""} type="date" />
      <SelectField label="生命状态" name="status" defaultValue={detail.status} options={["unknown", "alive", "deceased"]} />
      <Field label="出生地" name="birthplace" defaultValue={detail.birthplace ?? ""} />
      <Field label="标签（逗号分隔）" name="tags" defaultValue={detail.tags.join(", ")} />
      <p className="self-end pb-3 text-sm text-stone-600">当前所在地请在“所在地”Tab 维护；Primary Residency 是唯一权威来源。</p>
      <label className="lg:col-span-2 text-sm font-semibold text-stone-800">短简介<textarea name="intro" defaultValue={detail.intro ?? ""} rows={5} className="mt-1 w-full rounded-md border border-stone-400 p-3 font-normal" /></label>
      <label className="flex items-center gap-2 text-sm font-semibold text-stone-800"><input type="checkbox" name="is_featured" defaultChecked={detail.is_featured} />首页推荐</label>
      <Field label="修改理由" name="reason" defaultValue="Update Panda profile from Admin" required />
      <div className="lg:col-span-2 border-t border-stone-200 pt-4">
        <button disabled={disabled} type="submit" className="min-h-11 rounded-md bg-stone-950 px-5 py-2 font-semibold text-white disabled:opacity-40">保存基本资料</button>
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue, type = "text", required = false, mono = false }: { label: string; name: string; defaultValue: string; type?: string; required?: boolean; mono?: boolean }) {
  return <label className="text-sm font-semibold text-stone-800">{label}<input name={name} type={type} required={required} defaultValue={defaultValue} className={`mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal ${mono ? "font-mono" : ""}`} /></label>;
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return <label className="text-sm font-semibold text-stone-800">{label}<select name={name} defaultValue={defaultValue} className="mt-1 min-h-11 w-full rounded-md border border-stone-400 px-3 font-normal">{options.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function ReadSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-xl border border-stone-300 bg-white p-6"><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold text-stone-950">{title}</h2>{action}</div><div className="mt-4">{children}</div></section>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-600">{children}</p>;
}

function SourceChips({ ids }: { ids: string[] }) {
  return ids.length ? <span className="text-xs text-stone-500">来源：{ids.join(", ")}</span> : <span className="text-xs font-semibold text-amber-800">无来源</span>;
}

interface ModuleTabProps {
  detail: AdminPandaDetailRead;
  pandaId: string;
  disabled: boolean;
  onSaved: (message: string) => Promise<void> | void;
  onError: (message: string) => void;
}

function NamesTab({ detail, pandaId, disabled, onSaved, onError }: ModuleTabProps) {
  return <ReadSection title="名称"><p className="mb-4 text-sm text-stone-600">正式名、昵称、曾用名与其他名称来自 Trusted Identity；保存会追加到当前 Change Set。</p>{detail.names.length ? <ul className="divide-y divide-stone-200">{detail.names.map((name) => <li key={name.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto_auto]"><strong>{name.value}</strong><span className="text-sm">{name.name_kind} · {name.language_tag}{name.is_primary ? " · 主要" : ""}</span><SourceChips ids={name.source_ids} /></li>)}</ul> : <Empty>尚无名称记录。</Empty>}<NameCreateForm pandaId={pandaId} disabled={disabled} onSaved={onSaved} onError={onError} /></ReadSection>;
}

function FamilyTab({ detail, pandaId, disabled, onSaved, onError }: ModuleTabProps) {
  const parents = useMemo(() => new Map(detail.parents.map((parent) => [parent.role, parent])), [detail.parents]);
  return <ReadSection title="家族"><div className="grid gap-4 sm:grid-cols-2">{(["father", "mother"] as const).map((role) => { const parent = parents.get(role); return <div key={role} className="rounded-lg border border-stone-200 p-4"><span className="text-xs font-bold uppercase text-stone-500">{role === "father" ? "父亲" : "母亲"}</span>{parent ? <><p className="mt-2 font-bold">{parent.parent_name_zh}</p><p className="text-sm text-stone-600">{text(parent.parent_name_en)} · {parent.status}</p><SourceChips ids={parent.source_ids} /></> : <p className="mt-2 text-sm text-stone-600">尚未录入</p>}</div>; })}</div><p className="mt-5 text-sm text-stone-600">兄弟姐妹、子女与祖先继续由已审核父母关系计算，不维护第二份关系。保存父母前会阻止 self、重复角色和循环关系。</p><ParentCreateForm pandaId={pandaId} disabled={disabled} onSaved={onSaved} onError={onError} /></ReadSection>;
}

function LocationsTab({ detail, pandaId, disabled, onSaved, onError }: ModuleTabProps) {
  const current = detail.residencies.find((item) => item.residency_type === "primary" && !item.end_date);
  return <ReadSection title="所在地"><p className="mb-4 text-sm"><strong>当前所在地：</strong>{text(current?.facility_name ?? current?.coarse_location)}</p>{detail.residencies.length ? <ul className="divide-y divide-stone-200">{detail.residencies.map((item) => <li key={item.id} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto]"><span>{item.start_date} → {item.end_date ?? "至今"}</span><span><strong>{text(item.facility_name ?? item.coarse_location)}</strong><span className="block text-xs text-stone-500">{item.residency_type} · {item.status} · {item.start_precision}</span></span><SourceChips ids={item.source_ids} /></li>)}</ul> : <Empty>尚无所在地历史。</Empty>}<ResidencyCreateForm pandaId={pandaId} disabled={disabled} onSaved={onSaved} onError={onError} /></ReadSection>;
}

function EventsTab({ detail, pandaId, disabled, onSaved, onError }: ModuleTabProps) {
  return <ReadSection title="时间线"><p className="mb-4 text-sm text-stone-600">Calendar 与 Moments 使用同一事件真相；日期精度允许显式标记 unknown，不伪造具体日期精度。</p>{detail.events.length ? <ul className="divide-y divide-stone-200">{detail.events.map((event) => <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto]"><span>{event.event_date}</span><span><strong>{event.event_type}</strong><span className="block text-xs text-stone-500">{event.event_status} · {event.event_date_precision}</span></span><SourceChips ids={event.source_ids} /></li>)}</ul> : <Empty>尚无时间线事件。</Empty>}<EventCreateForm pandaId={pandaId} disabled={disabled} onSaved={onSaved} onError={onError} /></ReadSection>;
}

function ImagesTab({ detail, pandaId, disabled, onSaved, onError }: ModuleTabProps) {
  return <ReadSection title="图片与版权"><p className="mb-4 text-sm text-stone-600">只有已审核、权利信息完整的媒体才能进入公开资料；unknown 版权不能通过这里登记为公开媒体。</p>{detail.media.length ? <ul className="grid gap-3 sm:grid-cols-2">{detail.media.map((media) => <li key={media.id} className="rounded-lg border border-stone-200 p-4"><strong>{media.title ?? media.storage_path ?? media.url ?? media.id}</strong><p className="mt-1 text-sm text-stone-600">{media.is_cover ? "封面 · " : ""}{media.license ?? "版权状态未知"}</p><p className="mt-1 text-xs text-stone-500">{text(media.credit ?? media.photographer)} · {text(media.copyright_text)}</p><SourceChips ids={media.source_ids} /></li>)}</ul> : <Empty>尚无图片。</Empty>}<AdminPandaRawMediaUpload pandaId={pandaId} disabled={disabled} /><MediaCreateForm pandaId={pandaId} disabled={disabled} onSaved={onSaved} onError={onError} /></ReadSection>;
}

function SourcesTab({ detail, pandaId, disabled, onSaved, onError }: ModuleTabProps) {
  return <ReadSection title="资料来源"><p className="mb-4 text-sm text-stone-600">这里汇总名称、事实、家谱、所在地、事件和媒体实际引用的 Evidence Source。新建时会检查 URL 是否已存在。</p>{detail.sources.length ? <ul className="divide-y divide-stone-200">{detail.sources.map((source) => <li key={source.id} className="py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{source.title}</strong><p className="text-sm text-stone-600">{source.publisher} · {source.evidence_tier ?? "未分级"}</p></div><span className="text-xs font-semibold text-stone-600">{source.access_state} · {source.publication_status}</span></div><a href={source.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-stone-600 underline underline-offset-4">{source.url}</a></li>)}</ul> : <Empty>尚无关联来源。</Empty>}<SourceCreateForm pandaId={pandaId} disabled={disabled} onSaved={onSaved} onError={onError} /></ReadSection>;
}

function PublishTab({ detail, validation, working, onValidate, onReopen, onPublish }: { detail: AdminPandaDetailRead; validation: AdminPandaValidationRead | null; working: boolean; onValidate: () => void; onReopen: () => void; onPublish: () => void }) {
  const ready = detail.workflow.status === "ready";
  const failed = detail.workflow.status === "validation_failed";
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]"><ReadSection title="发布检查"><ul className="grid gap-2">{detail.quality_issues.length ? detail.quality_issues.map((issue) => <li key={issue} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">! {issueLabels[issue] ?? issue}</li>) : <li className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">✓ 当前后台完整度检查没有发现建议性缺口</li>}{validation?.issues.map((issue) => <li key={`${issue.category}-${issue.detail}`} className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950">错误 · {issue.category}: {issue.detail}</li>)}</ul>{failed ? <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950">发布检查未通过。先返回草稿修复资料，再重新运行检查；历史验证结果会继续保留在审计链中。</p> : null}</ReadSection><ReadSection title="发布状态"><dl className="grid gap-3 text-sm"><div><dt className="font-semibold text-stone-600">Change Set</dt><dd className="break-all">{detail.workflow.change_set_id ?? "无"}</dd></div><div><dt className="font-semibold text-stone-600">状态</dt><dd>{detail.workflow.status}</dd></div><div><dt className="font-semibold text-stone-600">Archive 基线</dt><dd>{detail.workflow.base_archive_version}</dd></div></dl><div className="mt-5 grid gap-3">{failed ? <button type="button" disabled={working || !detail.workflow.can_validate} onClick={onReopen} className="min-h-11 rounded-md border border-red-700 px-4 font-semibold text-red-900 disabled:opacity-40">返回草稿继续完善</button> : <button type="button" disabled={working || !detail.workflow.change_set_id || !detail.workflow.can_validate || ready} onClick={onValidate} className="min-h-11 rounded-md border border-stone-500 px-4 font-semibold disabled:opacity-40">运行发布检查</button>}<button type="button" disabled={working || !ready || !detail.workflow.can_publish} onClick={onPublish} className="min-h-11 rounded-md bg-stone-950 px-4 font-semibold text-white disabled:opacity-40">发布到 Archive</button>{ready && !detail.workflow.can_publish ? <p className="text-xs text-amber-800">发布要求具备发布 Capability 且最近完成认证。</p> : null}</div></ReadSection></div>;
}
