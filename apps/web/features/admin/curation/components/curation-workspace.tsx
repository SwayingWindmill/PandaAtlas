"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    column.accessor("reason", { header: "变更说明" }),
    column.accessor("state", { header: "处理状态", cell: (cell) => <Badge variant="outline" className="bg-slate-50 text-slate-800">{stateLabels[cell.getValue() as CurationState]}</Badge> }),
    column.accessor("changeCount", { header: "变更项数" }),
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
        <h2 className="text-xl font-bold text-stone-950">待确认的档案变更</h2>
        {detail.isPending && <p className="mt-3">正在加载变更详情…</p>}
        {detail.isError && <p role="alert" className="mt-3 text-red-800">{detail.error.message}</p>}
        {detail.data && <>
          <Card className="mt-3 gap-1 border-slate-200 bg-slate-50 py-3 shadow-none">
            <CardHeader>
              <CardTitle className="text-base text-slate-950">{detail.data.reason}</CardTitle>
              <p className="text-sm text-slate-700">关联熊猫编号 {detail.data.targetPandaId.slice(0, 8)} · {detail.data.originKind === "review" ? "来自贡献审核" : "来自资料采集"}</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <Badge variant="outline" className="bg-white text-slate-700">{stateLabels[detail.data.state as CurationState]}</Badge>
              <details>
                <summary className="cursor-pointer font-medium text-teal-800">查看完整编号和追溯信息</summary>
                <div className="mt-2 space-y-1 break-all font-mono text-xs">
                  <p>熊猫 ID：{detail.data.targetPandaId}</p>
                  <p>创建人 ID：{detail.data.createdByAccountId}</p>
                  <p>变更版本：{detail.data.version}</p>
                  {detail.data.reviewCaseId && <p>审核案件：{detail.data.reviewCaseId}</p>}
                  {detail.data.acquisitionBundleId && <p>采集批次：{detail.data.acquisitionBundleId}</p>}
                </div>
              </details>
            </CardContent>
          </Card>
          <h3 className="mt-5 font-bold text-stone-950">事实变更与来源</h3>
          {detail.data.changes.length > 0 && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">以下为拟应用的事实及佐证。当前档案值尚未提供，不能据此判断是否替换现有事实。</p>}
          {detail.data.changes.length === 0 && <p className="mt-2 text-sm text-stone-600">此变更集不包含直接事实变更。</p>}
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {detail.data.changes.map((change) => <li key={change.changeId}>
              <Card className="h-full gap-3 border-slate-200 py-4 shadow-none">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base text-slate-950">{factLabels[change.fieldKey] ?? `原始字段：${change.fieldKey}`}</CardTitle>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700">{change.certainty === "confirmed" ? "已确认" : "待证实"}</Badge>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700">
                  <p className="text-xs font-medium text-slate-600">建议记录的内容</p>
                  <p className="break-words text-lg font-semibold text-slate-950">{displayValue(change.value, change.fieldKey)}</p>
                  <p>证据核验日期：{change.lastVerifiedOn}</p>
                  <details><summary className="cursor-pointer font-medium text-teal-800">查看来源标识</summary><p className="mt-2 break-all font-mono text-xs">{change.sourceIds.join("、")}</p>{change.appliedAssertionId && <p className="mt-1 break-all font-mono text-xs">已应用事实：{change.appliedAssertionId}</p>}</details>
                </CardContent>
              </Card>
            </li>)}
          </ul>
          {detail.data.ownerChanges.length > 0 && <>
            <h3 className="mt-6 font-bold text-stone-950">领域变更与来源</h3>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {detail.data.ownerChanges.map((change) => <li key={change.changeId}>
                <Card className="h-full gap-3 border-slate-200 py-4 shadow-none">
                  <CardHeader><CardTitle className="text-base text-slate-950">{ownerModuleLabels[change.ownerModule] ?? change.ownerModule} · {operationLabels[change.operation] ?? `原始操作：${change.operation}`}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-700">
                    <p>证据核验日期：{change.lastVerifiedOn}</p>
                    <details><summary className="cursor-pointer font-medium text-teal-800">查看结构化变更字段</summary>
                      <dl className="mt-2 space-y-1">{Object.entries(change.payload).map(([key, value]) => <div key={key}><dt className="text-xs text-slate-600">原始字段：{key}</dt><dd className="break-all">{displayValue(value)}</dd></div>)}</dl>
                    </details>
                    <details><summary className="cursor-pointer font-medium text-teal-800">查看来源标识（{change.sourceIds.length}）</summary><p className="mt-2 break-all font-mono text-xs">{change.sourceIds.join("、")}</p></details>
                  </CardContent>
                </Card>
              </li>)}
            </ul>
          </>}
          {canManage && detail.data.state === "draft" && <Button type="button" disabled={busy} className="mt-5"
            onClick={() => { setMessage(""); validate.mutate(selectedId); }}>核验变更集</Button>}
          {canApprove && detail.data.state === "validated" && <form className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5" onSubmit={(event) => {
            event.preventDefault(); event.stopPropagation(); void approvalForm.handleSubmit();
          }}>
            <h3 className="font-bold text-stone-950">下一步：独立审批</h3>
            {isCreator ? <p className="text-sm text-amber-900">创建人不能审批自己提出的变更集，请由其他具备审批权限的工作人员处理。</p> :
              <p className="text-sm text-stone-700">审批通过将立即应用到内部档案，公开发布仍需单独处理。请先阅读上方全部事实和来源，再填写依据。</p>}
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
      {message && <p role="status" className="mt-5 rounded-md border border-teal-300 bg-teal-50 p-4 text-sm text-teal-950">{message}</p>}
      {error && <p role="alert" className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error.message}</p>}
    </div>
  );
}
