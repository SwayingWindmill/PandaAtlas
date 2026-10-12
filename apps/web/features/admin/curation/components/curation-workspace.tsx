"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { FolderCheck } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/ui/table/data-table";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import { curationDetailQueryOptions, curationKeys, curationListQueryOptions } from "../api/queries";
import { approveCurationChangeSet, validateCurationChangeSet } from "../api/service";
import type { CurationChangeSetSummary, CurationState } from "../api/types";

const PAGE_SIZE = 10;
const stateLabels: Record<CurationState, string> = {
  draft: "待核验", validated: "已核验", approved: "已批准", applied: "已应用", rejected: "已拒绝",
};
const states: readonly CurationState[] = ["draft", "validated", "approved", "applied", "rejected"];
const ownerModuleLabels: Record<string, string> = {
  panda: "熊猫档案", lineage: "谱系关系", life_history: "生活史",
};
const operationLabels: Record<string, string> = {
  "fact.propose": "提出事实", "fact.corroborate": "补充事实佐证", "fact.dispute": "提出事实争议",
  "name.add": "新增名称", "name.corroborate": "核验名称",
  "external_identifier.add": "新增外部标识", "external_identifier.corroborate": "核验外部标识",
  "parentage.create": "建立亲子关系", "residency.create": "新增居住记录", "event.create": "新增生命事件",
};
const factLabels: Record<string, string> = {
  "profile.sex": "性别", "profile.name": "名称", "profile.birth_date": "出生日期", "profile.death_date": "死亡日期",
};

function displayValue(value: unknown, fieldKey?: string): string {
  if (fieldKey === "profile.sex" && typeof value === "string") {
    return ({ male: "雄性", female: "雌性", unknown: "未知" } as Record<string, string>)[value] ?? value;
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

const column = createColumnHelper<CurationChangeSetSummary>();

export function CurationWorkspace() {
  const queryClient = useQueryClient();
  const { data: session } = useQuery(adminSessionQueryOptions);
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: true }));
  const [state, setState] = useQueryState("state", { shallow: true });
  const [selectedId, setSelectedId] = useQueryState("changeSet", { shallow: true });
  const [message, setMessage] = useState("");
  const [confirmApproval, setConfirmApproval] = useState(false);

  const filter = states.find((item) => item === state);
  const params = { limit: PAGE_SIZE, offset: (Math.max(1, page) - 1) * PAGE_SIZE, ...(filter ? { state: filter } : {}) };
  const listing = useQuery(curationListQueryOptions(params));
  const detail = useQuery({ ...curationDetailQueryOptions(selectedId ?? ""), enabled: Boolean(selectedId) });
  const canManage = session?.capabilities.includes("curation.change.manage") ?? false;
  const canApprove = session?.capabilities.includes("curation.change.approve") ?? false;
  const isCreator = detail.data?.createdByAccountId === session?.accountId;

  const invalidate = async (id: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: curationKeys.list(params).slice(0, 3) }),
      queryClient.invalidateQueries({ queryKey: curationKeys.detail(id) }),
    ]);
  };
  const validate = useMutation({
    mutationFn: validateCurationChangeSet,
    onSuccess: async (result) => { setMessage("变更集已核验，可以交由独立审批人处理。"); await invalidate(result.changeSetId); },
  });
  const approvalForm = useForm({
    defaultValues: { reason: "" },
    validators: { onSubmit: z.object({ reason: z.string().trim().min(3).max(2000) }) },
    onSubmit: ({ value }) => {
      if (selectedId && !isCreator && value.reason.trim().length >= 3) setConfirmApproval(true);
    },
  });
  const approve = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => approveCurationChangeSet(id, reason),
    onSuccess: async (result) => {
      setMessage("变更集已审批并应用至内部档案；公开发布仍需单独处理。");
      approvalForm.reset();
      await invalidate(result.changeSetId);
    },
  });

  const columns = useMemo(() => [
    column.accessor("reason", { header: "变更事项", cell: ({ row }) => (
      <div className="min-w-0">
        <p className="max-w-60 truncate font-medium text-slate-950" title={row.original.reason}>{row.original.reason}</p>
        <p className="mt-1 text-xs text-slate-600">{row.original.changeCount} 项 · 熊猫 {row.original.targetPandaId.slice(0, 8)}</p>
      </div>
    ) }),
    column.accessor("state", { header: "处理状态", cell: (cell) => <Badge variant="outline" className="bg-slate-50 text-slate-800">{stateLabels[cell.getValue() as CurationState]}</Badge> }),
    column.display({ id: "view", header: "操作", cell: ({ row }) => (
      <Button type="button" size="sm" variant="outline" aria-label={`查看变更：${row.original.reason}`} className={selectedId === row.original.changeSetId ? "border-teal-300 bg-teal-50 text-teal-900" : undefined} aria-pressed={selectedId === row.original.changeSetId} onClick={() => {
        void setSelectedId(row.original.changeSetId);
        setMessage(""); approvalForm.reset();
      }}>查看变更</Button>
    ) }),
  ], [approvalForm, selectedId, setSelectedId]);
  // TanStack Table deliberately exposes non-memoizable helpers.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: listing.data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });
  const busy = validate.isPending || approve.isPending;
  const error = validate.error ?? approve.error;
  const pages = Math.max(1, Math.ceil((listing.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-7 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">策展变更集</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">核验建议变更与来源，由另一位工作人员独立审批；公开发布另行处理。</p>
        </div>
      </header>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(21rem,0.9fr)_minmax(0,1.5fr)]">
      <section className="min-w-0 xl:sticky xl:top-24" aria-label="策展待办">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div><h2 className="text-base font-semibold text-slate-950">变更队列</h2><p className="mt-1 text-xs text-slate-600">选择一项，右侧同步展示变更证据</p></div>
          {listing.data && <Badge variant="outline" className="text-slate-700">{listing.data.total} 项</Badge>}
        </div>
        <label className="mb-3 flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
          处理状态
          <NativeSelect aria-label="筛选状态" value={filter ?? "all"}
            onChange={(event) => { void setState(event.target.value === "all" ? null : event.target.value); void setPage(1); void setSelectedId(null); }}
            className="min-h-10 min-w-40 border-slate-300 bg-white text-slate-900">
            <NativeSelectOption value="all">全部状态</NativeSelectOption>
            {states.map((value) => <NativeSelectOption key={value} value={value}>{stateLabels[value]}</NativeSelectOption>)}
          </NativeSelect>
        </label>
        {listing.isPending && <p role="status" className="py-5 text-sm text-slate-600">正在加载变更队列…</p>}
        {listing.isError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{listing.error.message}</p>}
        {listing.isSuccess && <>
          <DataTable table={table} emptyMessage="当前筛选下没有变更集。可切换状态查看其他记录。" />
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600">
            <span>第 {page} / {pages} 页</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => { void setPage(page - 1); void setSelectedId(null); }}>上一页</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => { void setPage(page + 1); void setSelectedId(null); }}>下一页</Button>
            </div>
          </div>
        </>}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="策展变更详情">
        {!selectedId && <div className="flex min-h-72 flex-col items-center justify-center px-8 py-12 text-center">
          <FolderCheck aria-hidden="true" className="size-9 text-slate-400" strokeWidth={1.5} />
          <h2 className="mt-4 text-base font-semibold text-slate-900">选择一项策展变更</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">在左侧队列选择记录后，可在这里查看建议事实、证据来源与下一步审批操作。</p>
        </div>}
        {selectedId && <>
        <p role="status" className={message ? "m-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950" : "sr-only"}>{message}</p>
        {error && <p role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error.message}</p>}
        {detail.isPending && <p role="status" className="p-5 text-sm text-slate-600">正在加载变更详情…</p>}
        {detail.isError && <p role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{detail.error.message}</p>}
        {detail.data && <>
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold leading-6 text-slate-950">{detail.data.reason}</h2>
                <p className="mt-1.5 text-sm text-slate-600">关联熊猫 {detail.data.targetPandaId.slice(0, 8)} · {detail.data.originKind === "review" ? "来自贡献审核" : "来自资料采集"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white text-slate-800">{stateLabels[detail.data.state as CurationState]}</Badge>
                <Button type="button" variant="outline" size="sm" onClick={() => { void setSelectedId(null); approvalForm.reset(); }}>关闭详情</Button>
              </div>
            </div>
            <details className="mt-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2">查看完整编号和追溯信息</summary>
              <div className="mt-2 space-y-1 break-all font-mono">
                <p>熊猫 ID：{detail.data.targetPandaId}</p>
                <p>创建人 ID：{detail.data.createdByAccountId}</p>
                <p>变更版本：{detail.data.version}</p>
                {detail.data.reviewCaseId && <p>审核案件：{detail.data.reviewCaseId}</p>}
                {detail.data.acquisitionBundleId && <p>采集批次：{detail.data.acquisitionBundleId}</p>}
              </div>
            </details>
          </div>
          <div className="space-y-5 px-5 py-5">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-950">事实变更与来源</h3><span className="text-xs tabular-nums text-slate-600">{detail.data.changes.length} 项</span></div>
            {detail.data.changes.length > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">以下为拟应用的事实及佐证。当前档案值尚未提供，不能据此判断是否替换现有事实。</p>}
            {detail.data.changes.length === 0 && <p className="text-sm text-slate-600">此变更集不包含直接事实变更。</p>}
            {detail.data.changes.length > 0 && <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {detail.data.changes.map((change) => <li key={change.changeId} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="text-xs text-slate-600">{factLabels[change.fieldKey] ?? `原始字段：${change.fieldKey}`}</p><p className="mt-1 break-words text-base font-semibold text-slate-950">{displayValue(change.value, change.fieldKey)}</p></div>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700">{change.certainty === "confirmed" ? "已确认" : "待证实"}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-600">证据核验：{change.lastVerifiedOn} · 来源 {change.sourceIds.length} 项</p>
                <details className="mt-2 text-xs"><summary className="cursor-pointer font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2">查看来源标识</summary><p className="mt-2 break-all font-mono text-slate-700">{change.sourceIds.join("、")}</p>{change.appliedAssertionId && <p className="mt-1 break-all font-mono text-slate-700">已应用事实：{change.appliedAssertionId}</p>}</details>
              </li>)}
            </ul>}
            {detail.data.ownerChanges.length > 0 && <>
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-950">领域变更与来源</h3><span className="text-xs text-slate-600">{detail.data.ownerChanges.length} 项</span></div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {detail.data.ownerChanges.map((change) => <li key={change.changeId} className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">{ownerModuleLabels[change.ownerModule] ?? change.ownerModule} · {operationLabels[change.operation] ?? `原始操作：${change.operation}`}</p>
                  <p className="mt-1 text-xs text-slate-600">证据核验：{change.lastVerifiedOn} · 来源 {change.sourceIds.length} 项</p>
                  <details className="mt-2 text-xs"><summary className="cursor-pointer font-medium text-teal-800">查看结构化变更字段</summary>
                    <dl className="mt-2 space-y-1">{Object.entries(change.payload).map(([key, value]) => <div key={key}><dt className="text-slate-600">原始字段：{key}</dt><dd className="break-all text-slate-900">{displayValue(value)}</dd></div>)}</dl>
                  </details>
                  <details className="mt-2 text-xs"><summary className="cursor-pointer font-medium text-teal-800">查看来源标识（{change.sourceIds.length}）</summary><p className="mt-2 break-all font-mono text-slate-700">{change.sourceIds.join("、")}</p></details>
                </li>)}
              </ul>
            </>}
          </div>
          {canManage && detail.data.state === "draft" && <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-950">下一步：确认来源与事实</h3>
            <p className="mt-1 text-sm text-slate-600">检查上方拟应用内容后进行核验；最终应用需要其他工作人员独立审批。</p>
            <Button type="button" disabled={busy} className="mt-3" onClick={() => { setMessage(""); validate.mutate(selectedId); }}>核验变更集</Button>
          </div>}
          {canApprove && detail.data.state === "validated" && <form className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-5" onSubmit={(event) => {
            event.preventDefault(); event.stopPropagation(); void approvalForm.handleSubmit();
          }}>
            <h3 className="text-sm font-semibold text-slate-950">下一步：独立审批</h3>
            {isCreator ? <p className="text-sm text-amber-900">创建人不能审批自己提出的变更集，请由其他具备审批权限的工作人员处理。</p> :
              <p className="text-sm text-stone-700">审批通过将立即应用到内部档案，公开发布仍需单独处理。请先阅读上方全部事实和来源，再填写依据。</p>}
            <approvalForm.Field name="reason">{(field) => (
              <label className="block text-sm font-semibold text-stone-800">
                审批原因
                <textarea aria-label="审批原因" className="mt-2 block min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  value={field.state.value} onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur} minLength={3} maxLength={2000} required />
              </label>
            )}</approvalForm.Field>
            <approvalForm.Subscribe selector={(formState) => ({ canSubmit: formState.canSubmit, reason: formState.values.reason })}>
              {({ canSubmit, reason }) => (
                <Button type="submit" disabled={busy || isCreator || !canSubmit || reason.trim().length < 3}>审批并应用</Button>
              )}
            </approvalForm.Subscribe>
          </form>}
        </>}
        </>}
      </section>
      </div>
      <AlertDialog open={confirmApproval} onOpenChange={setConfirmApproval}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认审批并应用档案变更？</AlertDialogTitle>
            <AlertDialogDescription>此次操作会将所选变更立即应用至内部档案；公开发布仍需单独处理。请确认不是由变更创建人自行审批。</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">{detail.data?.reason} · {detail.data ? detail.data.changes.length + detail.data.ownerChanges.length : 0} 项变更</p>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction disabled={busy || isCreator || !selectedId} onClick={() => {
              if (selectedId && !isCreator) approve.mutate({ id: selectedId, reason: approvalForm.state.values.reason.trim() });
            }}>确认审批并应用</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
