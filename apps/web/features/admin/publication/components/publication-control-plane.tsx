"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          className="font-semibold text-stone-950 underline decoration-stone-400 underline-offset-4"
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
    columnHelper.accessor("builtAt", { header: "构建时间", cell: (context) => formatDate(context.getValue()) }),
  ], [columnHelper, setReleaseId]);
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
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">发布</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">发布管理</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            检查不可变的公开版本、对比候选变更，并按权限执行发布、暂停和回滚操作。
          </p>
        </div>
        <label className="text-sm font-semibold text-stone-700">
          生命周期
          <select
            aria-label="生命周期"
            value={normalizedState ?? "all"}
            onChange={(event) => {
              const value = event.target.value;
              void setLifecycleState(value === "all" ? null : value);
              void setPage(1);
            }}
            className="ml-2 min-h-10 rounded-md border border-stone-400 bg-white px-3"
          >
            <option value="all">全部</option>
            <option value="building">构建中</option>
            <option value="sealed">已封存</option>
          </select>
        </label>
      </div>

      <section className="mt-6" aria-live="polite">
        {releases.isPending ? <p className="text-sm text-stone-600">正在加载版本列表…</p> : null}
        {releases.isError ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{releases.error.message}</p> : null}
        {releases.isSuccess ? (
          <>
            {current ? (
              <Card className="mb-4 gap-1 border-slate-200 bg-slate-50 py-3 shadow-none">
                <CardHeader><CardTitle className="text-base text-slate-950">当前公开版本</CardTitle></CardHeader>
                <CardContent>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-950">{current.version}</h2>
                    <p className="mt-1 text-sm text-slate-600">构建于 {formatDate(current.builtAt)}</p>
                    <Badge variant="outline" className="mt-2 bg-white text-slate-800">{current.suspended ? "已暂停对外提供" : "当前对外使用"}</Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-300 bg-white text-slate-900"
                    onClick={() => { setReason(""); setMessage(null); void setReleaseId(current.releaseId); }}
                  >
                    查看当前版本
                  </Button>
                </div>
                </CardContent>
              </Card>
            ) : null}
            {!current && <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">当前列表未提供公开版本详情，请先检查下方版本记录。</p>}
            <DataTable table={table} emptyMessage="当前筛选条件下没有版本记录。" />
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-stone-700">
              <span>第 {page} / {totalPages} 页 · 共 {releases.data.total} 个版本</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={page <= 1} onClick={() => void setPage(Math.max(1, page - 1))}>上一页</Button>
                <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => void setPage(Math.min(totalPages, page + 1))}>下一页</Button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {canManage ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">构建新候选版本（按需展开）</summary>
          <p className="mt-3 text-sm text-slate-600">构建只创建候选，不会立即改变公开内容。请先检查当前公开版本和已有候选。</p>
          <form className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => { event.preventDefault(); if (version.trim()) buildMutation.mutate(); }}>
            <label className="grid min-w-64 flex-1 gap-1 text-sm font-semibold text-slate-800">新版本号
              <input value={version} onChange={(event) => setVersion(event.target.value)}
                className="min-h-10 rounded-md border border-slate-300 px-3 font-normal" maxLength={80} />
            </label>
            <Button type="submit" variant="outline" disabled={busy || !version.trim()}>构建版本</Button>
          </form>
        </details>
      ) : null}

      {inspection.isPending && effectiveReleaseId ? <p className="mt-8 text-sm text-stone-600">正在加载版本详情…</p> : null}
      {inspection.isError ? <p role="alert" className="mt-8 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{inspection.error.message}</p> : null}
      {inspection.data ? (
        <div className="mt-8 grid gap-6">
          <section className="rounded-xl border border-stone-300 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">所选版本</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">{inspection.data.release.version}</h2>
                <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-teal-800">查看完整版本 ID</summary><p className="mt-1 break-all font-mono">{inspection.data.release.releaseId}</p></details>
              </div>
              <Badge variant="outline" className="bg-slate-50 text-slate-800">
                {inspection.data.release.isCurrent ? "当前版本" : "候选版本"} · {transitionLabels[inspection.data.release.lifecycleState] ?? inspection.data.release.lifecycleState}
              </Badge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {countCards.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-sm text-slate-600">{label}</span>
                  <strong className="text-lg font-semibold tabular-nums text-slate-950">{inspection.data.release.counts[key]}</strong>
                </div>
              ))}
            </div>
            {inspection.data.release.blockers.length ? (
              <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <h3 className="font-semibold text-amber-950">发布阻塞项</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
                  {inspection.data.release.blockers.map((blocker) => <li key={blocker}>{blocker === "This is the current public release." ? "当前公开版本不可执行此操作。" : blocker}</li>)}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-stone-300 bg-white p-5">
            <h2 className="text-xl font-bold text-stone-950">与当前版本的差异</h2>
            {inspection.data.release.isCurrent ? (
              <p className="mt-3 text-sm text-stone-600">当前展示的是已发布版本。</p>
            ) : inspection.data.changes.length ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inspection.data.changes.map((change) => (
                  <li key={change.resourceKind} className="rounded-lg border border-stone-200 p-4">
                    <strong>{changeLabels[change.resourceKind] ?? change.resourceKind}</strong>
                    <p className="mt-1 text-sm text-stone-700">新增 {change.added} · 更新 {change.changed} · 移除 {change.removed}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-stone-600">相比当前版本没有资源成员变更。</p>}
          </section>

          <section className="rounded-xl border border-stone-300 bg-white p-5">
            <h2 className="text-xl font-bold text-stone-950">状态变更记录</h2>
            {inspection.data.transitions.length ? (
              <ol className="mt-4 divide-y divide-stone-200">
                {inspection.data.transitions.map((transition) => (
                  <li key={transition.transitionId} className="grid gap-1 py-4 md:grid-cols-[10rem_11rem_1fr] md:gap-4">
                    <strong>{transitionLabels[transition.transitionType] ?? transition.transitionType}</strong>
                    <time className="text-sm text-stone-600">{formatDate(transition.occurredAt)}</time>
                    <div>
                      <p className="text-sm text-stone-800">{transition.reason}</p>
                      <p className="mt-1 text-xs text-stone-500">{transition.actor}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-sm text-stone-600">暂无版本状态变更记录。</p>}
          </section>

          {actions.length ? (
            <section className="rounded-xl border border-stone-300 bg-white p-5">
              <h2 className="text-xl font-bold text-stone-950">下一步：版本操作</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">正在操作版本 {selected?.version}，当前公开版本为 {current?.version ?? "未提供"}。请先查看上方资源差异和阻塞项，提交操作前还会再次确认。</p>
              <label className="mt-4 grid gap-1 text-sm font-semibold text-stone-800">
                操作原因
                <textarea
                  aria-label="操作原因"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="min-h-24 rounded-md border border-stone-400 p-3 font-normal"
                  maxLength={2000}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map(({ action, label }) => (
                  <Button
                    key={action}
                    type="button"
                    variant={action === "suspend" ? "outline" : "default"}
                    disabled={busy || reason.trim().length < 3}
                    className={action === "suspend" ? "border-red-300 text-red-800 hover:bg-red-50" : undefined}
                    onClick={() => setPendingAction({ releaseId: inspection.data.release.releaseId, version: inspection.data.release.version, action, reason: reason.trim() })}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-5 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900" role="status">{message}</p> : null}
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
      {mutationError ? (
        <p className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
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
    </div>
  );
}
