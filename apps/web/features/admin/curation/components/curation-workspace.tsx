"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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

function displayValue(value: unknown): string {
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
      if (selectedId && !isCreator) approve.mutate({ id: selectedId, reason: value.reason.trim() });
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
    column.accessor("reason", { header: "变更说明" }),
    column.accessor("originKind", { header: "来源", cell: (cell) => cell.getValue() === "review" ? "审核" : "采集" }),
    column.accessor("state", { header: "状态", cell: (cell) => stateLabels[cell.getValue() as CurationState] }),
    column.accessor("changeCount", { header: "变更项" }),
    column.accessor("createdAt", { header: "创建时间", cell: (cell) => new Date(cell.getValue()).toLocaleString("zh-CN") }),
    column.display({ id: "view", header: "操作", cell: ({ row }) => (
      <Button type="button" variant="outline" onClick={() => {
        void setSelectedId(row.original.changeSetId);
        setMessage(""); approvalForm.reset();
      }}>查看变更</Button>
    ) }),
  ], [approvalForm, setSelectedId]);
  // TanStack Table deliberately exposes non-memoizable helpers.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: listing.data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });
  const busy = validate.isPending || approve.isPending;
  const error = validate.error ?? approve.error;
  const pages = Math.max(1, Math.ceil((listing.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">运营 · 档案核验</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">策展变更集</h1>
          <p className="mt-3 max-w-3xl text-sm text-stone-700">按证据核验档案变更，独立审批后一次性应用到内部档案。公开发布需另外批准。</p>
        </div>
        <label className="text-sm font-semibold text-stone-800">
          筛选状态
          <select aria-label="筛选状态" value={filter ?? "all"}
            onChange={(event) => { void setState(event.target.value === "all" ? null : event.target.value); void setPage(1); }}
            className="ml-2 min-h-10 rounded-md border border-stone-400 bg-white px-3">
            <option value="all">全部</option>
            {states.map((value) => <option key={value} value={value}>{stateLabels[value]}</option>)}
          </select>
        </label>
      </div>

      <section className="mt-6" aria-label="策展变更集列表" aria-live="polite">
        {listing.isPending && <p>正在加载变更集…</p>}
        {listing.isError && <p role="alert" className="text-red-800">{listing.error.message}</p>}
        {listing.isSuccess && <>
          <DataTable table={table} emptyMessage="当前筛选条件下没有策展变更集。" />
          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-stone-700">
            <span>第 {page} / {pages} 页 · 共 {listing.data.total} 个变更集</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => void setPage(page - 1)}>上一页</Button>
              <Button type="button" variant="outline" disabled={page >= pages} onClick={() => void setPage(page + 1)}>下一页</Button>
            </div>
          </div>
        </>}
      </section>

      {selectedId && <section className="mt-8 rounded-xl border border-stone-300 bg-white p-6" aria-label="策展变更详情" aria-live="polite">
        <h2 className="text-xl font-bold text-stone-950">变更详情与证据</h2>
        {detail.isPending && <p className="mt-3">正在加载变更详情…</p>}
        {detail.isError && <p role="alert" className="mt-3 text-red-800">{detail.error.message}</p>}
        {detail.data && <>
          <div className="mt-3 grid gap-2 text-sm text-stone-800 md:grid-cols-2">
            <p>状态：<strong>{stateLabels[detail.data.state as CurationState]}</strong></p>
            <p>目标熊猫：<span className="break-all font-mono">{detail.data.targetPandaId}</span></p>
            <p>创建人：<span className="break-all font-mono">{detail.data.createdByAccountId}</span></p>
            <p>来源：{detail.data.originKind === "review" ? "审核" : "采集"} · 版本 {detail.data.version}</p>
            {detail.data.reviewCaseId && <p>关联审核案件：<span className="font-mono">{detail.data.reviewCaseId}</span></p>}
            {detail.data.acquisitionBundleId && <p>采集批次：{detail.data.acquisitionBundleId}</p>}
          </div>
          <p className="mt-3 text-sm text-stone-700">变更原因：{detail.data.reason}</p>
          <h3 className="mt-6 font-bold text-stone-950">事实变更与来源</h3>
          {detail.data.changes.length === 0 && <p className="mt-2 text-sm text-stone-600">此变更集不包含直接事实变更。</p>}
          <ul className="mt-3 divide-y divide-stone-200">
            {detail.data.changes.map((change) => <li key={change.changeId} className="space-y-2 py-3 text-sm">
              <p><strong>{change.fieldKey}</strong> · {change.certainty === "confirmed" ? "已确认" : "暂定"}</p>
              <p className="break-words">建议值：{displayValue(change.value)}</p>
              <p>证据日期：{change.lastVerifiedOn}</p>
              <p className="break-all">来源标识：{change.sourceIds.join("、")}</p>
              {change.appliedAssertionId && <p>已应用事实：{change.appliedAssertionId}</p>}
            </li>)}
          </ul>
          {detail.data.ownerChanges.length > 0 && <>
            <h3 className="mt-6 font-bold text-stone-950">领域变更与来源</h3>
            <ul className="mt-3 divide-y divide-stone-200">
              {detail.data.ownerChanges.map((change) => <li key={change.changeId} className="space-y-2 py-3 text-sm">
                <p><strong>{ownerModuleLabels[change.ownerModule] ?? change.ownerModule}</strong> · {operationLabels[change.operation] ?? change.operation}</p>
                <dl>{Object.entries(change.payload).map(([key, value]) => <div key={key} className="flex gap-3"><dt className="font-semibold">{key}</dt><dd className="break-all">{displayValue(value)}</dd></div>)}</dl>
                <p>证据日期：{change.lastVerifiedOn}</p>
                <p className="break-all">来源标识：{change.sourceIds.join("、")}</p>
              </li>)}
            </ul>
          </>}
          {canManage && detail.data.state === "draft" && <Button type="button" disabled={busy} className="mt-5"
            onClick={() => { setMessage(""); validate.mutate(selectedId); }}>核验变更集</Button>}
          {canApprove && detail.data.state === "validated" && <form className="mt-6 space-y-3 border-t border-stone-200 pt-4" onSubmit={(event) => {
            event.preventDefault(); event.stopPropagation(); void approvalForm.handleSubmit();
          }}>
            <h3 className="font-bold text-stone-950">独立审批并应用</h3>
            {isCreator ? <p className="text-sm text-amber-900">创建人不能审批自己提出的变更集，请由其他具备审批权限的工作人员处理。</p> :
              <p className="text-sm text-stone-700">操作将立即应用到内部档案；NestJS 会校验四眼原则和当前变更集状态。</p>}
            <approvalForm.Field name="reason">{(field) => (
              <label className="block text-sm font-semibold text-stone-800">
                审批原因
                <textarea aria-label="审批原因" className="mt-2 block min-h-24 w-full rounded-md border border-stone-400 p-3 font-normal"
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
      </section>}
      {message && <p role="status" className="mt-5 rounded-md border border-teal-300 bg-teal-50 p-4 text-sm text-teal-950">{message}</p>}
      {error && <p role="alert" className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error.message}</p>}
    </div>
  );
}
