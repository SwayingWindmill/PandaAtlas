"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/ui/table/data-table";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import {
  moderationAccountQueryOptions,
  moderationAppealsQueryOptions,
  moderationKeys,
  moderationMutationOptions,
} from "../api/queries";
import {
  APPEAL_STATES,
  type AppealState,
  ModerationAppealQueueItem,
  ModerationSanction,
} from "../api/types";
import {
  ADMIN_QUEUE_PAGE_SIZE,
  adminStateLabel,
  formatQueueAge,
  hasAdminCapability,
} from "../presentation";

const appealColumnHelper = createColumnHelper<ModerationAppealQueueItem>();

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function projectionState(active: boolean): { label: string; className: string } {
  return active
    ? { label: "已限制", className: "border-red-200 bg-red-50 text-red-900" }
    : { label: "正常", className: "border-emerald-200 bg-emerald-50 text-emerald-900" };
}

const sanctionActionLabels: Record<ModerationSanction["kind"], string> = {
  warning: "发送警告",
  submission_restricted: "禁止提交",
  attachment_restricted: "禁止附件",
  notification_restricted: "限制通知",
  account_suspended: "暂停账号",
  account_closed_for_abuse: "违规关闭账号",
};

export function ModerationWorkspace() {
  const queryClient = useQueryClient();
  const session = useQuery(adminSessionQueryOptions);
  const capabilities = session.data?.capabilities;
  const canRead = hasAdminCapability(capabilities, "moderation.sanction.read");
  const canApply = hasAdminCapability(capabilities, "moderation.sanction.apply");
  const canRestore = hasAdminCapability(capabilities, "moderation.sanction.restore");
  const canReadAppeals = hasAdminCapability(capabilities, "moderation.appeal.read");
  const canDecideAppeal = hasAdminCapability(capabilities, "moderation.appeal.decide");

  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: true }));
  const [state, setState] = useQueryState("state", { shallow: true });
  const [selectedAppealId, setSelectedAppealId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const normalizedState = APPEAL_STATES.includes(state as AppealState) ? state as AppealState : "open";
  const appealsQuery = {
    limit: ADMIN_QUEUE_PAGE_SIZE,
    offset: Math.max(0, page - 1) * ADMIN_QUEUE_PAGE_SIZE,
    state: normalizedState,
  };
  const appeals = useQuery({ ...moderationAppealsQueryOptions(appealsQuery), enabled: canReadAppeals });
  const effectiveAppealId = selectedAppealId ?? (accountId ? undefined : appeals.data?.items[0]?.appealCaseId);
  const selectedAppeal = appeals.data?.items.find((item) => item.appealCaseId === effectiveAppealId);
  const effectiveAccountId = accountId ?? selectedAppeal?.accountId;
  const account = useQuery({
    ...moderationAccountQueryOptions(effectiveAccountId ?? ""),
    enabled: canRead && Boolean(effectiveAccountId),
  });

  const [lookupAccountId, setLookupAccountId] = useState("");
  const [sanctionKind, setSanctionKind] = useState<ModerationSanction["kind"]>("warning");
  const [sanctionReasonCode, setSanctionReasonCode] = useState("policy_violation");
  const [sanctionInternal, setSanctionInternal] = useState("");
  const [sanctionVisible, setSanctionVisible] = useState("");
  const [sanctionEndsAt, setSanctionEndsAt] = useState("");
  const [confirmSanction, setConfirmSanction] = useState(false);
  const [restoreSanctionId, setRestoreSanctionId] = useState("");
  const [restoreReasonCode, setRestoreReasonCode] = useState("review_complete");
  const [restoreInternal, setRestoreInternal] = useState("");
  const [restoreVisible, setRestoreVisible] = useState("");
  const [appealOutcome, setAppealOutcome] = useState<"upheld" | "modified" | "overturned" | "dismissed">("upheld");
  const [appealInternal, setAppealInternal] = useState("");
  const [appealVisible, setAppealVisible] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const refreshAccount = async (targetAccountId: string | undefined) => {
    if (targetAccountId) {
      await queryClient.invalidateQueries({ queryKey: moderationKeys.account(targetAccountId) });
    }
  };

  const applyMutation = useMutation({
    ...moderationMutationOptions.applySanction(),
    onSuccess: async (sanction) => {
      setSanctionInternal("");
      setSanctionVisible("");
      setSanctionEndsAt("");
      setNotice(`已执行 ${adminStateLabel(sanction.kind)} 处理。`);
      await refreshAccount(sanction.accountId);
    },
  });
  const restoreMutation = useMutation({
    ...moderationMutationOptions.restoreSanction(),
    onSuccess: async () => {
      setRestoreInternal("");
      setRestoreVisible("");
      setNotice("限制已解除。");
      await refreshAccount(effectiveAccountId);
    },
  });
  const decideAppealMutation = useMutation({
    ...moderationMutationOptions.decideAppeal(),
    onSuccess: async () => {
      setAppealInternal("");
      setAppealVisible("");
      setNotice("申诉处理结果已记录。");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: moderationKeys.appealLists }),
        refreshAccount(selectedAppeal?.accountId),
      ]);
    },
  });

  const selectAppeal = useCallback(async (appeal: ModerationAppealQueueItem) => {
    setSelectedAppealId(appeal.appealCaseId);
    setAccountId(appeal.accountId);
    setNotice(null);
  }, []);

  const columns = useMemo(() => [
    appealColumnHelper.accessor("appealCaseId", {
      header: "申诉",
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left font-semibold text-stone-950 underline decoration-stone-400 underline-offset-4"
          onClick={() => void selectAppeal(row.original)}
        >
          <span className="block">账号 {row.original.accountId.slice(0, 8)}</span>
          <span className="mt-1 block text-xs font-normal text-stone-600">申诉 {row.original.appealCaseId.slice(0, 8)}</span>
        </button>
      ),
    }),
    appealColumnHelper.accessor("state", {
      header: "状态",
      cell: ({ getValue }) => <span className="capitalize">{adminStateLabel(getValue())}</span>,
    }),
    appealColumnHelper.accessor("ageSeconds", {
      header: "等待情况",
      cell: ({ row, getValue }) => <span className={row.original.slaOverdue ? "font-semibold text-red-700" : "text-stone-700"}>{formatQueueAge(getValue())}{row.original.slaOverdue ? " · 已超时" : ""}</span>,
    }),
  ], [selectAppeal]);
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: appeals.data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  const totalPages = Math.max(1, Math.ceil((appeals.data?.total ?? 0) / ADMIN_QUEUE_PAGE_SIZE));
  const subject = account.data?.subject;
  const sanctions = account.data?.sanctions ?? [];
  const mutationError = applyMutation.error ?? restoreMutation.error ?? decideAppealMutation.error;
  const busy = applyMutation.isPending || restoreMutation.isPending || decideAppealMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">内容治理</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">账号治理与申诉</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            查看账号治理状态、处理限制措施与用户申诉。所有变更均由服务端进行权限校验。
          </p>
        </div>
        {canReadAppeals ? (
          <label className="text-sm font-semibold text-stone-700">
            申诉状态
            <select
              aria-label="申诉状态"
              value={normalizedState}
              onChange={(event) => {
                void setState(event.target.value === "open" ? null : event.target.value);
                void setPage(1);
              }}
              className="ml-2 min-h-10 rounded-md border border-stone-400 bg-white px-3 capitalize"
            >
              {APPEAL_STATES.map((value) => <option key={value} value={value}>{adminStateLabel(value)}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {canRead ? (
        <form
          className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-stone-300 bg-white p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (lookupAccountId.trim()) {
              setSelectedAppealId(null);
              setAccountId(lookupAccountId.trim());
              setNotice(null);
            }
          }}
        >
          <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold text-stone-800">
            查询账号
            <input
              aria-label="账号 ID"
              value={lookupAccountId}
              onChange={(event) => setLookupAccountId(event.target.value)}
              placeholder="输入账号 UUID"
              className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-sm font-normal"
            />
          </label>
          <Button type="submit" disabled={!lookupAccountId.trim()}>查询账号</Button>
        </form>
      ) : null}

      {mutationError ? <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{mutationError.message}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p> : null}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(23rem,0.8fr)_minmax(0,1.5fr)]">
        <section className="min-w-0 rounded-xl border border-stone-300 bg-white p-5 shadow-sm xl:sticky xl:top-24" aria-labelledby="appeal-queue-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="appeal-queue-heading" className="text-xl font-bold text-stone-950">申诉队列</h2>
              <p className="mt-1 text-sm text-stone-600">选择申诉，核对账号当前的限制及申诉理由。</p>
            </div>
            {appeals.data ? <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">{appeals.data.total} 项申诉</span> : null}
          </div>
          {!canReadAppeals ? <p className="mt-5 text-sm text-stone-600">当前账号没有查看申诉的权限。</p> : null}
          {appeals.isPending && canReadAppeals ? <p className="mt-5 text-sm text-stone-600">正在加载申诉…</p> : null}
          {appeals.isError ? <p role="alert" className="mt-5 text-sm text-red-800">{appeals.error.message}</p> : null}
          {appeals.isSuccess ? (
            <>
              <div className="mt-5"><DataTable table={table} emptyMessage="当前没有需要处理的申诉。" /></div>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-stone-700">
                <span>第 {page} / {totalPages} 页</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={page <= 1} onClick={() => void setPage(Math.max(1, page - 1))}>上一页</Button>
                  <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => void setPage(Math.min(totalPages, page + 1))}>下一页</Button>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-labelledby="account-state-heading">
            {account.isPending && effectiveAccountId ? <p className="p-5 text-sm text-stone-600">正在加载账号信息…</p> : null}
            {account.isError ? <p role="alert" className="p-5 text-sm text-red-800">{account.error.message}</p> : null}
            {!effectiveAccountId ? <p className="p-5 text-sm text-stone-600">请选择申诉或输入账号 ID。</p> : null}
            {subject ? (
              <>
                <div className="border-b border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold text-teal-800">当前账号</p>
                  <h2 id="account-state-heading" className="mt-2 text-xl font-semibold text-slate-950">账号治理状态</h2>
                  <p className="mt-1 text-sm text-slate-700">账号编号 {subject.accountId.slice(0, 8)}</p>
                  <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2">查看完整账号 ID</summary><p className="mt-2 break-all font-mono">{subject.accountId}</p></details>
                </div>
                {subject.accountSuspended && <p className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">账号当前处于暂停状态，请在处理申诉前核对限制原因与时间。</p>}
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {[
                    ["提交", subject.submissionRestricted],
                    ["附件", subject.attachmentRestricted],
                    ["通知", subject.notificationRestricted],
                    ["账号", subject.accountSuspended || subject.accountClosedForAbuse],
                  ].map(([label, active]) => {
                    const state = projectionState(Boolean(active));
                    return (
                      <div key={String(label)} className={`rounded-lg border p-3 ${state.className}`}>
                        <p className="text-xs font-semibold uppercase">{label}</p>
                        <p className="mt-1 font-bold">{state.label}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-stone-200 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-stone-950">处理记录</h3>
                    <span className="text-xs text-stone-500">重复违规 {subject.repeatAbuseCount} 次</span>
                  </div>
                  {sanctions.length ? (
                    <ul className="mt-3 space-y-2">
                      {sanctions.map((sanction) => (
                        <li key={sanction.sanctionId} className="rounded-lg border border-stone-200 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold capitalize">{adminStateLabel(sanction.kind)}</p>
                              <p className="mt-1 text-xs text-stone-600">原因：{adminStateLabel(sanction.reasonCode)} · {formatDate(sanction.startsAt)}</p>
                              {sanction.endsAt ? <p className="mt-1 text-xs text-stone-500">截止于 {formatDate(sanction.endsAt)}</p> : null}
                            </div>
                            {canRestore ? <Button type="button" size="sm" variant="outline" onClick={() => setRestoreSanctionId(sanction.sanctionId)}>解除</Button> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-stone-600">该账号暂无处理记录。</p>}
                </div>
              </>
            ) : null}
          </section>

          {selectedAppeal ? (
            <section className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">当前申诉</p>
                  <h2 className="mt-1 text-lg font-bold text-stone-950">用户申诉内容</h2>
                  <p className="mt-1 text-xs text-stone-600">申诉编号 {selectedAppeal.appealCaseId.slice(0, 8)}</p>
                </div>
                <Badge variant="outline" className={selectedAppeal.slaOverdue ? "border-red-200 bg-red-50 text-red-900" : "border-stone-200 bg-stone-50 text-stone-700"}>{selectedAppeal.slaOverdue ? "已超过处理时限" : adminStateLabel(selectedAppeal.state)}</Badge>
              </div>
              <blockquote className="mt-4 rounded-lg border-l-4 border-stone-400 bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                {selectedAppeal.userStatement}
              </blockquote>
              <p className="mt-3 text-xs text-stone-500">关联限制 {selectedAppeal.sanctionId.slice(0, 8)} · 截止时间 {formatDate(selectedAppeal.firstResponseDueAt)}</p>
            </section>
          ) : null}

          {subject && canApply ? (
            <form
              className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (!effectiveAccountId || !sanctionInternal.trim() || !sanctionVisible.trim()) return;
                setConfirmSanction(true);
              }}
            >
              <h2 className="text-lg font-bold text-stone-950">执行限制</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">此操作会改变账号的实际使用权限。请先核对处理记录，再填写对用户可见的解释与内部依据。</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">限制类型
                  <select aria-label="限制类型" value={sanctionKind} onChange={(event) => setSanctionKind(event.target.value as ModerationSanction["kind"])} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    <option value="warning">警告</option><option value="submission_restricted">禁止提交</option><option value="attachment_restricted">禁止附件</option><option value="notification_restricted">限制通知</option><option value="account_suspended">暂停账号</option><option value="account_closed_for_abuse">违规关闭账号</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">原因代码<input aria-label="限制原因代码" value={sanctionReasonCode} onChange={(event) => setSanctionReasonCode(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-sm font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">截止时间 <span className="font-normal text-stone-500">(可选)</span><input aria-label="限制截止时间" type="datetime-local" value={sanctionEndsAt} onChange={(event) => setSanctionEndsAt(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">内部处理说明<textarea aria-label="限制内部说明" value={sanctionInternal} onChange={(event) => setSanctionInternal(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">告知用户的说明<textarea aria-label="限制用户说明" value={sanctionVisible} onChange={(event) => setSanctionVisible(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !sanctionReasonCode.trim() || !sanctionInternal.trim() || !sanctionVisible.trim()}>执行限制</Button>
              </div>
            </form>
          ) : null}

          <AlertDialog open={confirmSanction} onOpenChange={setConfirmSanction}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认{sanctionActionLabels[sanctionKind]}？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作会对以下账号记录处理措施，并可能立即改变其使用权限。请核对账号 ID 和限制类型后再确认。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950">
                <p>账号 ID：<span className="break-all font-mono">{effectiveAccountId}</span></p>
                <p>措施：{sanctionActionLabels[sanctionKind]}</p>
                <p>截止时间：{sanctionEndsAt ? formatDate(new Date(sanctionEndsAt).toISOString()) : "未设置"}</p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-700 text-white hover:bg-red-800"
                  onClick={() => {
                    if (!effectiveAccountId) return;
                    applyMutation.mutate({
                      accountId: effectiveAccountId,
                      input: {
                        kind: sanctionKind,
                        reasonCode: sanctionReasonCode.trim(),
                        internalExplanation: sanctionInternal.trim(),
                        userVisibleExplanation: sanctionVisible.trim(),
                        idempotencyKey: crypto.randomUUID(),
                        ...(sanctionEndsAt ? { endsAt: new Date(sanctionEndsAt).toISOString() } : {}),
                      },
                    });
                  }}
                >确认{sanctionActionLabels[sanctionKind]}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {subject && canRestore && restoreSanctionId ? (
            <form
              className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (!restoreInternal.trim() || !restoreVisible.trim()) return;
                restoreMutation.mutate({
                  sanctionId: restoreSanctionId,
                  input: {
                    reasonCode: restoreReasonCode.trim(),
                    internalExplanation: restoreInternal.trim(),
                    userVisibleExplanation: restoreVisible.trim(),
                    idempotencyKey: crypto.randomUUID(),
                  },
                });
              }}
            >
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-stone-950">解除限制</h2><p className="mt-1 font-mono text-xs text-stone-500">{restoreSanctionId}</p></div><Button type="button" variant="outline" size="sm" onClick={() => setRestoreSanctionId("")}>取消</Button></div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">原因代码<input aria-label="解除原因代码" value={restoreReasonCode} onChange={(event) => setRestoreReasonCode(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-sm font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">内部处理说明<textarea aria-label="解除内部说明" value={restoreInternal} onChange={(event) => setRestoreInternal(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">告知用户的说明<textarea aria-label="解除用户说明" value={restoreVisible} onChange={(event) => setRestoreVisible(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !restoreReasonCode.trim() || !restoreInternal.trim() || !restoreVisible.trim()}>解除限制</Button>
              </div>
            </form>
          ) : null}

          {selectedAppeal && selectedAppeal.state !== "closed" && canDecideAppeal ? (
            <form
              className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (!appealInternal.trim() || !appealVisible.trim()) return;
                decideAppealMutation.mutate({
                  appealCaseId: selectedAppeal.appealCaseId,
                  input: {
                    outcome: appealOutcome,
                    internalExplanation: appealInternal.trim(),
                    userVisibleExplanation: appealVisible.trim(),
                  },
                });
              }}
            >
              <h2 className="text-lg font-bold text-stone-950">处理申诉</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">处理结果
                  <select aria-label="申诉处理结果" value={appealOutcome} onChange={(event) => setAppealOutcome(event.target.value as typeof appealOutcome)} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    <option value="upheld">维持原决定</option><option value="modified">调整决定</option><option value="overturned">撤销决定</option><option value="dismissed">驳回申诉</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">内部处理说明<textarea aria-label="申诉内部说明" value={appealInternal} onChange={(event) => setAppealInternal(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">告知用户的说明<textarea aria-label="申诉用户说明" value={appealVisible} onChange={(event) => setAppealVisible(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !appealInternal.trim() || !appealVisible.trim()}>保存申诉决定</Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
