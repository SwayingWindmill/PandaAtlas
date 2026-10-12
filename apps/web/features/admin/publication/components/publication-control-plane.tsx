"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import Link from "next/link";
import { GitCompareArrows, History, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const countCards: Array<{ key: keyof PublicationReleaseSummary["counts"]; label: string }> = [
  { key: "panda", label: "熊猫" },
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
  const normalizedState = lifecycleState === "building" || lifecycleState === "sealed" ? lifecycleState : undefined;
  const offset = Math.max(0, page - 1) * PAGE_SIZE;
  const releases = useQuery(publicationReleaseListQueryOptions({
    limit: PAGE_SIZE,
    offset,
    ...(normalizedState ? { lifecycleState: normalizedState } : {}),
  }));
  const effectiveReleaseId = releaseId ?? releases.data?.currentReleaseId ?? releases.data?.items[0]?.releaseId;
  const inspection = useQuery({
    ...publicationReleaseInspectionQueryOptions(effectiveReleaseId ?? ""),
    enabled: Boolean(effectiveReleaseId),
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
  const canManage = capability(session.data?.capabilities, "publication.release.manage");
  const canActivate = capability(session.data?.capabilities, "publication.release.activate");
  const canEmergency = capability(session.data?.capabilities, "publication.emergency");

  const actions = useMemo(() => {
    if (!selected) return [] as Array<{ action: PublicationAction; label: string }>;
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
  }, [canActivate, canEmergency, canManage, current, selected]);

  const columnHelper = createColumnHelper<PublicationReleaseSummary>();
  const columns = useMemo(() => [
    columnHelper.accessor("version", {
      header: "版本",
      cell: (context) => (
        <button
          type="button"
          aria-pressed={effectiveReleaseId === context.row.original.releaseId}
          aria-label={`查看版本 ${context.getValue()}`}
          className={effectiveReleaseId === context.row.original.releaseId ? "rounded-md bg-teal-50 px-2 py-1 font-semibold text-teal-900 underline decoration-teal-500 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" : "rounded-md px-2 py-1 font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"}
          onClick={() => { setReason(""); setMessage(null); void setReleaseId(context.row.original.releaseId); }}
        >
          {context.getValue()}
        </button>
      ),
    }),
    columnHelper.accessor("lifecycleState", { header: "生命周期", cell: ({ getValue }) => transitionLabels[getValue()] ?? getValue() }),
    columnHelper.display({
      id: "delivery",
      header: "发布状态",
      cell: ({ row }) => row.original.isCurrent
        ? (row.original.suspended ? "当前版本 · 已暂停" : "当前版本")
        : (row.original.suspended ? "已暂停" : "候选版本"),
    }),
  ], [columnHelper, setReleaseId, effectiveReleaseId]);
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
    <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-7 md:px-8">
      <header className="space-y-1.5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">发布管理</h1>
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
          <Button type="button" size="sm" variant="outline" onClick={() => { setReason(""); setMessage(null); void setReleaseId(current.releaseId); }}>查看当前版本</Button>
        </>}
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(19rem,0.9fr)_minmax(0,1.6fr)]">
      <section aria-label="版本队列" className="min-w-0 xl:sticky xl:top-24">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold text-slate-950">版本队列</h2><p className="mt-1 text-xs text-slate-600">选择版本，右侧检查内容和执行操作</p></div>
          {releases.data && <Badge variant="outline" className="bg-white text-slate-700">{releases.data.total} 个版本</Badge>}
        </div>
        <label className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
          生命周期
          <select
            aria-label="生命周期"
            value={normalizedState ?? "all"}
            onChange={(event) => {
              const value = event.target.value;
              void setLifecycleState(value === "all" ? null : value);
              void setPage(1);
            }}
            className="min-h-10 min-w-36 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <option value="all">全部</option>
            <option value="building">构建中</option>
            <option value="sealed">已封存</option>
          </select>
        </label>


      <div aria-live="polite">
        {releases.isPending ? <p role="status" className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">正在加载版本列表…</p> : null}
        {releases.isError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{releases.error.message}</p> : null}
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
        <details className="group mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">构建新候选版本（按需展开）</summary>
          <p className="mt-3 text-sm text-slate-600">构建只创建候选，不会立即改变公开内容。请先检查当前公开版本和已有候选。</p>
          <form className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => { event.preventDefault(); if (version.trim()) buildMutation.mutate(); }}>
            <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold text-slate-800">新版本号
              <input value={version} onChange={(event) => setVersion(event.target.value)}
                className="min-h-10 rounded-md border border-slate-300 px-3 font-normal" maxLength={80} />
            </label>
            <Button type="submit" variant="outline" disabled={busy || !version.trim()}>构建版本</Button>
          </form>
        </details>
      ) : null}
      </section>

      <section aria-label="所选版本检查" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
      {!effectiveReleaseId && <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center"><PackageCheck className="size-9 text-slate-400" aria-hidden="true"/><h2 className="mt-3 font-semibold text-slate-950">选择一个版本</h2><p className="mt-2 text-sm text-slate-600">在左侧版本队列选择记录，以检查差异和可执行的操作。</p></div>}

      {inspection.isPending && effectiveReleaseId ? <p role="status" className="p-5 text-sm text-slate-600">正在加载版本详情…</p> : null}
      {inspection.isError ? <p role="alert" className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{inspection.error.message}</p> : null}
      {inspection.data ? (
        <div className="divide-y divide-slate-200">
          <div className="px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-600">所选版本 · {inspection.data.release.isCurrent ? "当前公开" : "候选"}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{inspection.data.release.version}</h2>
                <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-teal-800">查看完整版本 ID</summary><p className="mt-1 break-all font-mono">{inspection.data.release.releaseId}</p></details>
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
            ) : inspection.data.changes.length ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {inspection.data.changes.map((change) => (
                  <li key={change.resourceKind} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <strong className="text-sm text-slate-950">{changeLabels[change.resourceKind] ?? change.resourceKind}</strong>
                    <p className="text-sm tabular-nums text-slate-700">新增 {change.added} · 更新 {change.changed} · 移除 {change.removed}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-600">相比当前版本没有资源成员变更。</p>}
          </section>

          {actions.length ? (
            <section className="bg-slate-50 px-5 py-5">
              <h2 className="text-base font-semibold text-slate-950">下一步：版本操作</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">正在操作版本 {selected?.version}，当前公开版本为 {current?.version ?? "未提供"}。请先查看上方资源差异和阻塞项，提交操作前还会再次确认。</p>
              <label className="mt-4 grid gap-1 text-sm font-semibold text-slate-800">
                操作原因
                <textarea aria-label="操作原因" value={reason} onChange={(event) => setReason(event.target.value)}
                  className="min-h-24 rounded-lg border border-slate-300 bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" maxLength={2000} />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map(({ action, label }) => (
                  <Button key={action} type="button" variant={action === "suspend" || action === "rollback" ? "outline" : "default"}
                    disabled={busy || reason.trim().length < 3}
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
                      <details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer text-teal-800">查看操作账号</summary><p className="mt-1 break-all font-mono">{transition.actor}</p></details>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-sm text-stone-600">暂无版本状态变更记录。</p>}
          </section>

        </div>
      ) : null}
      </section>
      </div>

      <AlertDialog open={Boolean(pendingAction)} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认{pendingAction ? actionLabels[pendingAction.action] : "版本操作"}？</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction ? actionEffects[pendingAction.action] : "请核对版本后继续。"} 本次操作会记录在审计历史中。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p>所选版本：<strong>{pendingAction?.version}</strong></p>
            <p>当前公开版本：<strong>{current?.version ?? "未提供"}</strong></p>
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
