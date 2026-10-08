"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table/data-table";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import {
  buildPublicationRelease,
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
    mutationFn: ({ releaseId: target, action }: { releaseId: string; action: PublicationAction }) =>
      runPublicationAction(target, action, reason.trim()),
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
          onClick={() => void setReleaseId(context.row.original.releaseId)}
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

      {canManage ? (
        <form
          className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-stone-300 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (version.trim()) buildMutation.mutate();
          }}
        >
          <label className="grid min-w-64 flex-1 gap-1 text-sm font-semibold text-stone-800">
            新版本号
            <input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              className="min-h-10 rounded-md border border-stone-400 px-3 font-normal"
              maxLength={80}
            />
          </label>
          <Button type="submit" disabled={busy || !version.trim()}>构建版本</Button>
        </form>
      ) : null}

      <section className="mt-6" aria-live="polite">
        {releases.isPending ? <p className="text-sm text-stone-600">正在加载版本列表…</p> : null}
        {releases.isError ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{releases.error.message}</p> : null}
        {releases.isSuccess ? (
          <>
            {releases.data.currentRelease ? (
              <div className="mb-4 rounded-xl border border-stone-300 bg-slate-900 p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">当前公开版本</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">{releases.data.currentRelease.version}</h2>
                    <p className="mt-1 text-sm text-stone-300">构建于 {formatDate(releases.data.currentRelease.builtAt)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-stone-500 bg-transparent text-white hover:bg-stone-800"
                    onClick={() => void setReleaseId(releases.data.currentRelease?.releaseId ?? null)}
                  >
                    查看当前版本
                  </Button>
                </div>
              </div>
            ) : null}
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

      {inspection.isPending && effectiveReleaseId ? <p className="mt-8 text-sm text-stone-600">正在加载版本详情…</p> : null}
      {inspection.isError ? <p role="alert" className="mt-8 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{inspection.error.message}</p> : null}
      {inspection.data ? (
        <div className="mt-8 grid gap-6">
          <section className="rounded-xl border border-stone-300 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">所选版本</p>
                <h2 className="mt-1 text-2xl font-bold text-stone-950">{inspection.data.release.version}</h2>
                <p className="mt-1 text-sm text-stone-600">{inspection.data.release.releaseId}</p>
              </div>
              <span className="rounded-full border border-stone-300 px-3 py-1 text-sm font-semibold">
                {inspection.data.release.isCurrent ? "当前版本" : "候选版本"} · {transitionLabels[inspection.data.release.lifecycleState] ?? inspection.data.release.lifecycleState}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {countCards.map(({ key, label }) => (
                <div key={key} className="rounded-lg bg-stone-100 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
                  <div className="mt-1 text-2xl font-bold text-stone-950">{inspection.data.release.counts[key]}</div>
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
              <h2 className="text-xl font-bold text-stone-950">版本操作</h2>
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
                    onClick={() => actionMutation.mutate({ releaseId: inspection.data.release.releaseId, action })}
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
      {mutationError ? <p className="mt-5 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">{mutationError.message}</p> : null}
    </div>
  );
}
