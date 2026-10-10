"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import Link from "next/link";
import { GitCompareArrows, History, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/ui/table/data-table";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import {
  buildPublicationRelease,
  PublicationAuthenticationError,
  type PublicationAction,
  publicationKeys,
  publicationReleaseInspectionQueryOptions,
  publicationReleaseListQueryOptions,
  type PublicationReleaseSummary,
  runPublicationAction,
} from "../api/queries";

const PAGE_SIZE = 10;
const DIFF_PAGE_SIZE = 10;

const countCards: Array<{ key: keyof PublicationReleaseSummary["counts"]; label: string }> = [
  { key: "panda", label: "熊猫" },
  { key: "institution", label: "机构" },
  { key: "place", label: "地点" },
  { key: "lineage", label: "谱系" },
  { key: "residency", label: "居住史" },
  { key: "lifeEvent", label: "生命事件" },
  { key: "media", label: "媒体" },
  { key: "evidence", label: "证据" },
];

const changeLabels: Record<string, string> = {
  panda: "熊猫",
  institution: "机构",
  place: "地点",
  lineage: "谱系",
  residency: "居住史",
  life_event: "生命事件",
  media: "媒体",
  evidence: "证据",
};

const changeKindLabels: Record<string, string> = {
  added: "目标版本新增", changed: "成员快照变化", removed: "目标版本不再包含",
};

const transitionLabels: Record<string, string> = {
  built: "已构建",
  sealed: "已封存",
  activated: "已启用",
  rolled_back: "已回滚",
  suspended: "已暂停",
  restored: "已恢复",
};

const actionSuccessLabels: Record<PublicationAction, string> = {
  seal: "已封存",
  activate: "已启用",
  rollback: "已回滚至",
  suspend: "已暂停",
  restore: "已恢复",
};
const actionLabels: Record<PublicationAction, string> = {
  seal: "封存版本", activate: "启用版本", rollback: "回滚至此版本", suspend: "暂停版本", restore: "恢复版本",
};
const actionEffects: Record<PublicationAction, string> = {
  seal: "该候选版本将被封存，后续可在符合要求时启用。",
  activate: "所选版本会成为新的当前公开版本，替换现有公开版本。",
  rollback: "公开内容将切换回较早的版本，现有公开版本不再是当前版本。",
  suspend: "所选版本将暂停对外提供内容。请先核对影响范围。",
  restore: "所选版本将解除暂停限制。请先核对原暂停原因。",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function capability(capabilities: readonly string[] | undefined, value: string): boolean {
  return capabilities?.includes(value) ?? false;
}

export function PublicationControlPlane() {
  const queryClient = useQueryClient();
  const session = useQuery(adminSessionQueryOptions);
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: true }));
  const [lifecycleState, setLifecycleState] = useQueryState("state", { shallow: true });
  const [releaseId, setReleaseId] = useQueryState("release", { shallow: true });
  const [diffPage, setDiffPage] = useQueryState("diffPage", parseAsInteger.withDefault(1).withOptions({ shallow: true }));
  const normalizedState = lifecycleState === "building" || lifecycleState === "sealed" ? lifecycleState : undefined;
  const offset = Math.max(0, page - 1) * PAGE_SIZE;
  const releases = useQuery(publicationReleaseListQueryOptions({
    limit: PAGE_SIZE,
    offset,
    ...(normalizedState ? { lifecycleState: normalizedState } : {}),
  }));
  const effectiveReleaseId = releaseId ?? releases.data?.currentReleaseId ?? releases.data?.items[0]?.releaseId;
  const inspection = useQuery({
    ...publicationReleaseInspectionQueryOptions(effectiveReleaseId ?? "", Math.max(0, diffPage - 1) * DIFF_PAGE_SIZE),
    enabled: Boolean(effectiveReleaseId),
    retry: false,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[3] === effectiveReleaseId ? previous : undefined,
  });
  const [version, setVersion] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ releaseId: string; version: string; action: PublicationAction; reason: string } | null>(null);

  const invalidatePublication = async () => {
    await queryClient.invalidateQueries({ queryKey: publicationKeys.all });
  };

  const buildMutation = useMutation({
    mutationFn: () => buildPublicationRelease(version.trim()),
    onSuccess: async (release) => {
      setVersion("");
      setMessage(`已构建版本 ${release.version}。`);
      await setReleaseId(release.releaseId);
      await invalidatePublication();
    },
  });
  const actionMutation = useMutation({
    mutationFn: ({ releaseId: target, action, reason: actionReason }: { releaseId: string; action: PublicationAction; reason: string }) =>
      runPublicationAction(target, action, actionReason),
    onSuccess: async (release, input) => {
      setReason("");
      setMessage(`${actionSuccessLabels[input.action]} ${release.version}。`);
      await invalidatePublication();
    },
  });

  const selected = inspection.data?.release;
  const current = releases.data?.currentRelease ?? releases.data?.items.find((release) => release.isCurrent);
  const changeSummary = inspection.data?.changes.reduce((acc, change) => ({
    added: acc.added + change.added,
    changed: acc.changed + change.changed,
    removed: acc.removed + change.removed,
  }), { added: 0, changed: 0, removed: 0 }) ?? { added: 0, changed: 0, removed: 0 };
  const diffPages = Math.max(1, Math.ceil((inspection.data?.changeTotal ?? 0) / DIFF_PAGE_SIZE));
  const canManage = capability(session.data?.capabilities, "publication.release.manage");
  const canActivate = capability(session.data?.capabilities, "publication.release.activate");
  const canEmergency = capability(session.data?.capabilities, "publication.emergency");

  const actions = useMemo(() => {
    // A direct release URL can still render its detail when the collection is unavailable.
    // Do not infer there is no current release from a failed collection read.
    if (!selected || !releases.isSuccess) return [] as Array<{ action: PublicationAction; label: string }>;
    const available: Array<{ action: PublicationAction; label: string }> = [];
    if (selected.lifecycleState === "building" && canManage) {
      available.push({ action: "seal", label: "封存版本" });
      return available;
    }
    if (selected.lifecycleState !== "sealed") return available;
    if (selected.suspended) {
      if (canEmergency) available.push({ action: "restore", label: "恢复版本" });
      return available;
    }
    if (!selected.isCurrent && canActivate) {
      if (!current || new Date(selected.builtAt) > new Date(current.builtAt)) {
        available.push({ action: "activate", label: "启用版本" });
      } else if (selected.projectionSchemaVersion === current.projectionSchemaVersion) {
        available.push({ action: "rollback", label: "回滚至此版本" });
      }
    }
    if (canEmergency) available.push({ action: "suspend", label: "暂停版本" });
    return available;
  }, [canActivate, canEmergency, canManage, current, releases.isSuccess, selected]);

  const columnHelper = createColumnHelper<PublicationReleaseSummary>();
  const columns = useMemo(() => [
    columnHelper.accessor("version", {
      header: "版本",
      cell: (context) => (
        <Button
          type="button"
          aria-pressed={effectiveReleaseId === context.row.original.releaseId}
          aria-label={`查看版本 ${context.getValue()}`}
          variant="ghost"
          className={`h-auto min-w-0 max-w-full flex-col items-start gap-1 px-2 py-2 text-left text-sm font-semibold underline underline-offset-4 ${effectiveReleaseId === context.row.original.releaseId ? "bg-teal-50 text-teal-900" : "text-slate-900"}`}
          onClick={() => { setReason(""); setMessage(null); void setDiffPage(1); void setReleaseId(context.row.original.releaseId); }}
        >
          <span>{context.getValue()}</span>
          <span className="text-xs font-normal no-underline text-slate-600">{context.row.original.isCurrent ? "当前公开" : "候选版本"}{context.row.original.suspended ? " · 已暂停" : ""}</span>
        </Button>
      ),
    }),
    columnHelper.accessor("lifecycleState", { header: "生命周期", cell: ({ getValue }) => transitionLabels[getValue()] ?? getValue() }),
  ], [columnHelper, setReleaseId, setDiffPage, effectiveReleaseId]);
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: releases.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil((releases.data?.total ?? 0) / PAGE_SIZE));
  const busy = buildMutation.isPending || actionMutation.isPending;
  const mutationError = buildMutation.error ?? actionMutation.error;

  return (
    <div className="mx-auto w-full max-w-[1480px] px-6 pb-12 pt-9 md:px-9">
      <header className="space-y-1.5 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">发布管理</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
            对照当前公开版本检查候选内容，确认差异与影响后，再执行启用、回滚或暂停。
          </p>
        </div>
      </header>
      <section aria-label="当前公开版本" className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <PackageCheck className="size-5 shrink-0 text-teal-800" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-600">当前公开版本</p>
            <p className="mt-0.5 text-base font-semibold text-slate-950">{current?.version ?? (releases.isPending ? "正在加载…" : "尚未提供")}</p>
          </div>
        </div>
        {current && <>
          <Badge variant="outline" className="border-slate-200 text-slate-800">{current.suspended ? "已暂停对外提供" : "当前对外使用"}</Badge>
          <span className="text-xs text-slate-600">构建于 {formatDate(current.builtAt)}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => { setReason(""); setMessage(null); void setDiffPage(1); void setReleaseId(current.releaseId); }}>查看当前版本</Button>
        </>}
      </section>

      <ResizablePanelGroup orientation="horizontal" className="mt-5 min-h-[720px] items-stretch">
      <ResizablePanel defaultSize="38%" minSize="29%" maxSize="55%" className="min-w-0">
      <section aria-label="版本队列" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold text-slate-950">版本队列</h2><p className="mt-1 text-xs text-slate-600">选择版本，右侧检查内容和执行操作</p></div>
          {releases.data && <Badge variant="outline" className="bg-white text-slate-700">{releases.data.total} 个版本</Badge>}
        </div>
        <label className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
          生命周期
          <NativeSelect
            aria-label="生命周期"
            value={normalizedState ?? "all"}
            onChange={(event) => {
              const value = event.target.value;
              void setLifecycleState(value === "all" ? null : value);
              void setPage(1);
            }}
            className="min-h-10 min-w-36 border-slate-200 bg-white text-slate-900"
          >
            <NativeSelectOption value="all">全部</NativeSelectOption>
            <NativeSelectOption value="building">构建中</NativeSelectOption>
            <NativeSelectOption value="sealed">已封存</NativeSelectOption>
          </NativeSelect>
        </label>


      <div aria-live="polite">
        {releases.isPending ? <div role="status" aria-label="正在加载版本列表" className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : null}
        {releases.isError ? <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p>{releases.error.message}</p><Button variant="outline" size="sm" onClick={() => void releases.refetch()}>重试加载版本列表</Button></div> : null}
        {releases.isSuccess ? (
          <>
            <DataTable table={table} emptyMessage="当前筛选条件下没有版本记录；可选择其他生命周期查看。" />
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600">
              <span>第 {page} / {totalPages} 页 · 共 {releases.data.total} 个版本</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => void setPage(Math.max(1, page - 1))}>上一页</Button>
                <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => void setPage(Math.min(totalPages, page + 1))}>下一页</Button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {canManage ? (
        <Collapsible className="group mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <CollapsibleTrigger className="min-h-9 text-left text-sm font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">构建新候选版本（按需展开）</CollapsibleTrigger>
          <CollapsibleContent>
          <p className="mt-3 text-sm text-slate-600">构建只创建候选，不会立即改变公开内容。请先检查当前公开版本和已有候选。</p>
          <form className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => { event.preventDefault(); if (version.trim()) buildMutation.mutate(); }}>
            <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold text-slate-800">新版本号
              <Input value={version} onChange={(event) => setVersion(event.target.value)}
                className="h-10 bg-white font-normal" maxLength={80} />
            </label>
            <Button type="submit" variant="outline" disabled={busy || !version.trim()}>构建版本</Button>
          </form>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      </section>

      </ResizablePanel>
      <ResizableHandle withHandle aria-label="调整版本队列与检查详情宽度" className="mx-2 w-1 rounded-full bg-slate-200 [&>div]:h-10 [&>div]:w-3 [&>div]:rounded-full [&>div]:border-slate-300 [&>div]:bg-white" />
      <ResizablePanel defaultSize="62%" minSize="45%" className="min-w-0">
      <section aria-label="所选版本检查" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <p role="status" className={message ? "m-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950" : "sr-only"}>{message}</p>
      {mutationError ? (
        <p className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          {mutationError.message}{" "}
          {mutationError instanceof PublicationAuthenticationError && (
            <Link className="font-semibold underline underline-offset-2" href={mutationError.code === "auth.aalRequired"
              ? "/admin/security/mfa?next=%2Fadmin%2Fpublication"
              : "/auth/login?next=%2Fadmin%2Fpublication"}>
              {mutationError.code === "auth.aalRequired" ? "前往双重验证" : "重新登录"}
            </Link>
          )}
        </p>
      ) : null}
      {!effectiveReleaseId && <Empty className="min-h-[520px]"><EmptyHeader><EmptyMedia variant="icon"><PackageCheck aria-hidden="true" /></EmptyMedia><EmptyTitle><h2>选择一个版本</h2></EmptyTitle><EmptyDescription>在左侧版本队列选择记录，以检查差异和可执行的操作。</EmptyDescription></EmptyHeader></Empty>}

      {inspection.isPending && effectiveReleaseId ? <div role="status" aria-label="正在加载版本详情" className="space-y-4 p-6"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-20 w-full" /><Skeleton className="h-24 w-full" /></div> : null}
      {inspection.isError ? (
        <div role="alert" className="m-5 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <span>{inspection.error.message}</span>
          <Button type="button" variant="outline" size="sm" disabled={inspection.isFetching} onClick={() => void inspection.refetch()}>重新加载版本详情</Button>
        </div>
      ) : null}
      {inspection.data ? (
        <div className="divide-y divide-slate-200">
          <div className="px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-600">所选版本 · {inspection.data.release.isCurrent ? "当前公开" : "候选"}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{inspection.data.release.version}</h2>
                <Collapsible className="mt-2 text-xs text-slate-600"><CollapsibleTrigger className="min-h-8 font-medium text-teal-800">查看完整版本 ID</CollapsibleTrigger><CollapsibleContent><p className="mt-1 break-all font-mono">{inspection.data.release.releaseId}</p></CollapsibleContent></Collapsible>
              </div>
              <Badge variant="outline" className="bg-slate-50 text-slate-800">
                {inspection.data.release.isCurrent ? "当前版本" : "候选版本"} · {transitionLabels[inspection.data.release.lifecycleState] ?? inspection.data.release.lifecycleState}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
              {countCards.map(({ key, label }) => (
                <div key={key} className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-slate-600">{label}</span>
                  <strong className="text-sm font-semibold tabular-nums text-slate-950">{inspection.data.release.counts[key]}</strong>
                </div>
              ))}
            </div>
            {inspection.data.release.blockers.length ? (
              <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <h3 className="font-semibold text-amber-950">{inspection.data.release.isCurrent ? "当前版本操作提示" : "发布阻塞项"}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
                  {inspection.data.release.blockers.map((blocker) => <li key={blocker}>{blocker === "This is the current public release." ? "此版本已是当前公开版本，无需再次启用或回滚至自身。" : blocker}</li>)}
                </ul>
              </div>
            ) : null}
          </div>

          <section className="px-5 py-5">
            <div className="mb-3 flex items-center gap-2"><GitCompareArrows size={17} className="text-teal-800" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">与当前版本的差异</h2></div>
            {inspection.data.release.isCurrent ? (
              <p className="text-sm text-slate-600">当前展示的是已发布版本。</p>
            ) : !inspection.data.currentReleaseId ? (
              <p className="text-sm text-slate-600">目前没有公开版本可供对比；不能据此认定候选版本没有变化。</p>
            ) : inspection.data.changes.length ? (
              <>
                <p className="mb-3 flex flex-wrap items-baseline gap-2 text-sm leading-6 text-slate-700">
                  <strong className="text-slate-950">{inspection.data.changeTotal} 条资源成员变更</strong>
                  <span> · 当前版本 {current?.version ?? "版本号未提供"} → 目标版本 {inspection.data.release.version}</span>
                  <a href="#publication-resource-changes-heading" className="font-medium text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">查看具体资源</a>
                </p>
                <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 py-3 text-center">
                  <div><strong className="block text-lg font-semibold tabular-nums text-slate-950">{changeSummary.added}</strong><span className="text-xs text-slate-600">新增</span></div>
                  <div><strong className="block text-lg font-semibold tabular-nums text-slate-950">{changeSummary.changed}</strong><span className="text-xs text-slate-600">快照变更</span></div>
                  <div><strong className={`block text-lg font-semibold tabular-nums ${changeSummary.removed ? "text-amber-900" : "text-slate-950"}`}>{changeSummary.removed}</strong><span className="text-xs text-slate-600">移除</span></div>
                </div>
                {changeSummary.removed > 0 && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
                    {changeSummary.removed} 条移除：这些资源不再属于目标公开版本。这里不表示数据库记录已被删除。
                  </p>
                )}
                <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {inspection.data.changes.map((change) => (
                    <li key={change.resourceKind} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                      <strong className="text-sm text-slate-950">{changeLabels[change.resourceKind] ?? change.resourceKind}</strong>
                      <p className="text-sm tabular-nums text-slate-700">新增 {change.added} · 更新 {change.changed} · 移除 {change.removed}</p>
                    </li>
                  ))}
                </ul>
                <section aria-labelledby="publication-resource-changes-heading" className="mt-5">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 id="publication-resource-changes-heading" className="text-sm font-semibold text-slate-950">受影响资源明细</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        具体资源 ID 和变化类型来自版本快照比较，不代表字段级差异；无法从这里判断哪个属性发生了变化。
                      </p>
                    </div>
                    <span className="text-xs tabular-nums text-slate-600">
                      {inspection.data.changeOffset + 1}–{Math.min(inspection.data.changeOffset + inspection.data.changeItems.length, inspection.data.changeTotal)} / {inspection.data.changeTotal}
                    </span>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow><TableHead>受影响资源</TableHead><TableHead className="w-36 text-right">变更类型</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                      {inspection.data.changeItems.map((item) => (
                        <TableRow key={`${item.resourceKind}:${item.resourceId}`}>
                          <TableCell className="min-w-0">
                            <span className="block text-xs text-slate-600">{changeLabels[item.resourceKind] ?? item.resourceKind}</span>
                            <code className="mt-1 block break-all font-mono text-xs text-slate-900">{item.resourceId}</code>
                          </TableCell>
                          <TableCell className={`text-right text-xs font-medium ${item.changeType === "removed" ? "text-amber-900" : "text-slate-700"}`}>{changeKindLabels[item.changeType] ?? item.changeType}</TableCell>
                        </TableRow>
                      ))}
                      </TableBody>
                    </Table>
                  </div>
                  {inspection.isPlaceholderData && <p role="status" className="mt-2 text-xs text-slate-600">正在更新本页资源明细…</p>}
                  {diffPages > 1 && (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs tabular-nums text-slate-600">第 {diffPage} / {diffPages} 页</span>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" disabled={diffPage <= 1 || inspection.isPlaceholderData} onClick={() => void setDiffPage(diffPage - 1)}>上一页差异</Button>
                        <Button type="button" size="sm" variant="outline" disabled={diffPage >= diffPages || inspection.isPlaceholderData} onClick={() => void setDiffPage(diffPage + 1)}>下一页差异</Button>
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : <p className="text-sm text-slate-600">与当前公开版本相比，没有检测到资源成员的新增、快照变化或移除；不等于已验证所有业务字段。</p>}
          </section>

          {releases.isError && (
            <p role="status" className="mx-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              无法确认当前公开版本。仍可查看所选版本详情，但在版本列表恢复之前不能执行发布操作。
            </p>
          )}
          {actions.length ? (
            <section className="bg-slate-50 px-5 py-5">
              <h2 className="text-base font-semibold text-slate-950">下一步：版本操作</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">正在操作版本 {selected?.version}，当前公开版本为 {current?.version ?? "未提供"}。请先查看上方资源差异和阻塞项，提交操作前还会再次确认。</p>
              <label className="mt-4 grid gap-1 text-sm font-semibold text-slate-800">
                操作原因
                <Textarea aria-label="操作原因" value={reason} onChange={(event) => setReason(event.target.value)}
                  className="min-h-24 bg-white font-normal" maxLength={2000} />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map(({ action, label }) => (
                  <Button key={action} type="button" variant={action === "suspend" || action === "rollback" ? "outline" : "default"}
                    disabled={busy || inspection.isPlaceholderData || reason.trim().length < 3}
                    className={action === "suspend" || action === "rollback" ? "border-red-300 text-red-800 hover:bg-red-50" : undefined}
                    onClick={() => setPendingAction({ releaseId: inspection.data.release.releaseId, version: inspection.data.release.version, action, reason: reason.trim() })}>
                    {label}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="px-5 py-5">
            <div className="flex items-center gap-2"><History size={17} className="text-slate-600" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">状态变更记录</h2></div>
            {inspection.data.transitions.length ? (
              <ol className="mt-3 divide-y divide-slate-200">
                {inspection.data.transitions.map((transition) => (
                  <li key={transition.transitionId} className="grid gap-1 py-3 md:grid-cols-[6.5rem_8rem_1fr] md:gap-3">
                    <strong className="text-sm text-slate-950">{transitionLabels[transition.transitionType] ?? transition.transitionType}</strong>
                    <time className="text-sm text-stone-600">{formatDate(transition.occurredAt)}</time>
                    <div>
                      <p className="text-sm text-stone-800">{transition.reason}</p>
                      <Collapsible className="mt-1 text-xs text-slate-600"><CollapsibleTrigger className="min-h-8 text-teal-800">查看操作账号</CollapsibleTrigger><CollapsibleContent><p className="mt-1 break-all font-mono">{transition.actor}</p></CollapsibleContent></Collapsible>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-sm text-stone-600">暂无版本状态变更记录。</p>}
          </section>

        </div>
      ) : null}
      </section>
      </ResizablePanel>
      </ResizablePanelGroup>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认{pendingAction ? actionLabels[pendingAction.action] : "版本操作"}？</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction ? actionEffects[pendingAction.action] : "请核对版本后继续。"} 本次操作会记录在审计历史中。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p>所选版本：<strong>{pendingAction?.version}</strong></p>
            <p>当前公开版本：<strong>{current?.version ?? "未提供"}</strong></p>
            {pendingAction && (pendingAction.action === "activate" || pendingAction.action === "rollback") && inspection.data && (
              <p>本次快照对比：<strong>{inspection.data.changeTotal} 条资源成员变更</strong>
                （{changeSummary.added} 条新增、{changeSummary.changed} 条快照变化、{changeSummary.removed} 条移除）。
                明细不代表字段级差异。
              </p>
            )}
            <p className="break-words">操作依据：{pendingAction?.reason}</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={pendingAction?.action === "suspend" || pendingAction?.action === "rollback" ? "bg-red-700 text-white hover:bg-red-800" : undefined}
              disabled={busy || !pendingAction}
              onClick={() => { if (pendingAction) actionMutation.mutate(pendingAction); }}
            >确认{pendingAction ? actionLabels[pendingAction.action] : "操作"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
