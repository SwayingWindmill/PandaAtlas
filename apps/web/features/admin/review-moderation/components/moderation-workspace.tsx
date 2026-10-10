"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquareWarning } from "lucide-react";
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

type SanctionDraft = {
  kind: ModerationSanction["kind"];
  reasonCode: string;
  internal: string;
  visible: string;
  endsAt: string;
};

type RestoreDraft = { sanctionId: string; reasonCode: string; internal: string; visible: string };
type AppealDraft = { outcome: "upheld" | "modified" | "overturned" | "dismissed"; internal: string; visible: string };

const initialSanctionDraft: SanctionDraft = {
  kind: "warning", reasonCode: "policy_violation", internal: "", visible: "", endsAt: "",
};
const initialRestoreDraft: RestoreDraft = { sanctionId: "", reasonCode: "review_complete", internal: "", visible: "" };
const initialAppealDraft: AppealDraft = { outcome: "upheld", internal: "", visible: "" };

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
  const [sanctionDraft, setSanctionDraft] = useState<SanctionDraft>(initialSanctionDraft);
  const [restoreDraft, setRestoreDraft] = useState<RestoreDraft>(initialRestoreDraft);
  const [appealDraft, setAppealDraft] = useState<AppealDraft>(initialAppealDraft);
  const [pendingSanction, setPendingSanction] = useState<{ accountId: string; draft: SanctionDraft } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearActionDrafts = useCallback(() => {
    setSanctionDraft(initialSanctionDraft);
    setRestoreDraft(initialRestoreDraft);
    setAppealDraft(initialAppealDraft);
    setPendingSanction(null);
  }, []);

  const refreshAccount = async (targetAccountId: string | undefined) => {
    if (targetAccountId) {
      await queryClient.invalidateQueries({ queryKey: moderationKeys.account(targetAccountId) });
    }
  };

  const applyMutation = useMutation({
    ...moderationMutationOptions.applySanction(),
    onSuccess: async (sanction) => {
      setSanctionDraft((draft) => ({ ...draft, internal: "", visible: "", endsAt: "" }));
      setNotice(`已执行 ${adminStateLabel(sanction.kind)} 处理。`);
      await refreshAccount(sanction.accountId);
    },
  });
  const restoreMutation = useMutation({
    ...moderationMutationOptions.restoreSanction(),
    onSuccess: async () => {
      setRestoreDraft(initialRestoreDraft);
      setNotice("限制已解除。");
      await refreshAccount(effectiveAccountId);
    },
  });
  const decideAppealMutation = useMutation({
    ...moderationMutationOptions.decideAppeal(),
    onSuccess: async () => {
      setAppealDraft(initialAppealDraft);
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
    clearActionDrafts();
    setNotice(null);
  }, [clearActionDrafts]);

  const columns = useMemo(() => [
    appealColumnHelper.accessor("appealCaseId", {
      header: "申诉",
      cell: ({ row }) => (
        <Button
          type="button"
          aria-pressed={effectiveAppealId === row.original.appealCaseId}
          variant="ghost"
          className={`h-auto w-full min-w-0 flex-col items-start gap-1 whitespace-normal px-2 py-2 text-left font-semibold ${effectiveAppealId === row.original.appealCaseId ? "bg-teal-50 text-teal-900" : "text-slate-950"}`}
          onClick={() => void selectAppeal(row.original)}
        >
          <span>账号 {row.original.accountId.slice(0, 8)}</span>
          <span className="text-xs font-normal text-slate-600">申诉 {row.original.appealCaseId.slice(0, 8)}</span>
          <span className="text-xs font-semibold text-teal-800 underline underline-offset-2">查看申诉</span>
        </Button>
      ),
    }),
    appealColumnHelper.accessor("state", {
      header: "状态",
      cell: ({ row, getValue }) => <div className="space-y-1.5"><Badge variant="outline">{adminStateLabel(getValue())}</Badge><p className={row.original.slaOverdue ? "text-xs font-semibold text-red-700" : "text-xs text-slate-600"}>{formatQueueAge(row.original.ageSeconds)}{row.original.slaOverdue ? " · 已超时" : ""}</p></div>,
    }),
  ], [selectAppeal, effectiveAppealId]);
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: appeals.data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  const totalPages = Math.max(1, Math.ceil((appeals.data?.total ?? 0) / ADMIN_QUEUE_PAGE_SIZE));
  const subject = account.data?.subject;
  const sanctions = account.data?.sanctions ?? [];
  const mutationError = applyMutation.error ?? restoreMutation.error ?? decideAppealMutation.error;
  const busy = applyMutation.isPending || restoreMutation.isPending || decideAppealMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-[1480px] px-6 pb-12 pt-9 md:px-9">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">账号治理与申诉</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
            查看账号治理状态、处理限制措施与用户申诉。所有变更均由服务端进行权限校验。
          </p>
        </div>
        {canReadAppeals ? (
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            申诉状态
            <NativeSelect
              aria-label="申诉状态"
              value={normalizedState}
              onChange={(event) => {
                void setState(event.target.value === "open" ? null : event.target.value);
                void setPage(1);
              }}
              className="min-h-10 min-w-36 bg-white"
            >
              {APPEAL_STATES.map((value) => <NativeSelectOption key={value} value={value}>{adminStateLabel(value)}</NativeSelectOption>)}
            </NativeSelect>
          </label>
        ) : null}
      </header>

      {canRead ? (
        <Collapsible className="group mt-5 rounded-2xl border border-slate-200 bg-white">
          <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between gap-3 px-5 text-left text-sm font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
            通过账号编号查询
            <ChevronDown size={17} className="transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
        <form
          className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (lookupAccountId.trim()) {
              setSelectedAppealId(null);
              setAccountId(lookupAccountId.trim());
              clearActionDrafts();
              setNotice(null);
            }
          }}
        >
          <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold text-slate-800">
            查询账号
            <Input
              aria-label="账号 ID"
              value={lookupAccountId}
              onChange={(event) => setLookupAccountId(event.target.value)}
              placeholder="输入账号 UUID"
              className="h-10 bg-white font-mono text-sm font-normal"
            />
          </label>
          <Button type="submit" disabled={!lookupAccountId.trim()}>查询账号</Button>
        </form>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {mutationError ? <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{mutationError.message}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p> : null}

      <ResizablePanelGroup orientation="horizontal" className="mt-5 min-h-[680px] items-stretch">
      <ResizablePanel defaultSize="38%" minSize="29%" maxSize="55%" className="min-w-0">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-labelledby="appeal-queue-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="appeal-queue-heading" className="text-base font-semibold text-slate-950">申诉队列</h2>
              <p className="mt-1 text-xs text-slate-600">选择申诉，核对账号限制及申诉理由</p>
            </div>
            {appeals.data ? <Badge variant="outline" className="bg-white text-slate-700">{appeals.data.total} 项申诉</Badge> : null}
          </div>
          {!canReadAppeals ? <p className="mt-5 text-sm text-stone-600">当前账号没有查看申诉的权限。</p> : null}
          {appeals.isPending && canReadAppeals ? <div role="status" aria-label="正在加载申诉" className="mt-5 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : null}
          {appeals.isError ? <div role="alert" className="mt-5 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{appeals.error.message}</p><Button type="button" size="sm" variant="outline" onClick={() => void appeals.refetch()}>重试加载申诉队列</Button></div> : null}
          {appeals.isSuccess ? (
            <>
              <ScrollArea className={appeals.data.items.length > 7 ? "mt-4 h-[min(60vh,720px)] rounded-xl" : "mt-4 rounded-xl"}><DataTable table={table} emptyMessage="当前没有需要处理的申诉。" /></ScrollArea>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600">
                <span>第 {page} / {totalPages} 页</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => void setPage(Math.max(1, page - 1))}>上一页</Button>
                  <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => void setPage(Math.min(totalPages, page + 1))}>下一页</Button>
                </div>
              </div>
            </>
          ) : null}
        </section>

      </ResizablePanel>
      <ResizableHandle withHandle aria-label="调整申诉队列与账号详情宽度" className="mx-2 w-1 rounded-full bg-slate-200 [&>div]:h-10 [&>div]:w-3 [&>div]:rounded-full [&>div]:border-slate-300 [&>div]:bg-white" />
      <ResizablePanel defaultSize="62%" minSize="45%" className="min-w-0">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs" aria-label="账号治理状态">
            {account.isPending && effectiveAccountId ? <div role="status" aria-label="正在加载账号信息" className="space-y-4 p-5"><Skeleton className="h-7 w-1/2" /><Skeleton className="h-20 w-full" /><Skeleton className="h-28 w-full" /></div> : null}
            {account.isError ? <div role="alert" className="space-y-3 p-5 text-sm text-red-800"><p>{account.error.message}</p><Button type="button" size="sm" variant="outline" onClick={() => void account.refetch()}>重新加载账号信息</Button></div> : null}
            {!effectiveAccountId ? <Empty className="min-h-[500px]"><EmptyHeader><EmptyMedia variant="icon"><MessageSquareWarning aria-hidden="true" /></EmptyMedia><EmptyTitle><h2>选择申诉或查询账号</h2></EmptyTitle><EmptyDescription>从左侧选择申诉，或按账号编号查询，查看限制状态和可执行的处理操作。</EmptyDescription></EmptyHeader></Empty> : null}
            {subject ? (
              <>
                <div className="border-b border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold text-teal-800">当前账号</p>
                  <h2 id="account-state-heading" className="mt-2 text-xl font-semibold text-slate-950">账号治理状态</h2>
                  <p className="mt-1 text-sm text-slate-700">账号编号 {subject.accountId.slice(0, 8)}</p>
                  <Collapsible className="mt-2 text-xs text-slate-600"><CollapsibleTrigger className="min-h-8 font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2">查看完整账号 ID</CollapsibleTrigger><CollapsibleContent><p className="mt-2 break-all font-mono">{subject.accountId}</p></CollapsibleContent></Collapsible>
                  {(canApply || (canDecideAppeal && selectedAppeal)) && (
                    <nav aria-label="账号处理快捷操作" className="mt-3 flex flex-wrap gap-2">
                      {selectedAppeal && canDecideAppeal && selectedAppeal.state !== "closed" && <Button asChild size="sm" variant="outline"><a href="#moderation-appeal-decision">处理这项申诉</a></Button>}
                      {canApply && <Button asChild size="sm" variant="outline"><a href="#moderation-sanction-form">执行账号限制</a></Button>}
                    </nav>
                  )}
                </div>
                {subject.accountSuspended && <p className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">账号当前处于暂停状态，请在处理申诉前核对限制原因与时间。</p>}
                <dl className="grid gap-3 border-b border-slate-200 px-5 py-4 sm:grid-cols-4">
                  {[
                    ["提交", subject.submissionRestricted],
                    ["附件", subject.attachmentRestricted],
                    ["通知", subject.notificationRestricted],
                    ["账号", subject.accountSuspended || subject.accountClosedForAbuse],
                  ].map(([label, active]) => {
                    const state = projectionState(Boolean(active));
                    return (
                      <div key={String(label)} className="space-y-2">
                        <dt className="text-xs font-medium text-slate-600">{label}</dt>
                        <dd><Badge variant="outline" className={state.className}>{state.label}</Badge></dd>
                      </div>
                    );
                  })}
                </dl>
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
                            {canRestore ? <Button type="button" size="sm" variant="outline" onClick={() => setRestoreDraft({ ...initialRestoreDraft, sanctionId: sanction.sanctionId })}>解除</Button> : null}
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
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">当前申诉</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">用户申诉内容</h2>
                  <p className="mt-1 text-xs text-stone-600">申诉编号 {selectedAppeal.appealCaseId.slice(0, 8)}</p>
                </div>
                <Badge variant="outline" className={selectedAppeal.slaOverdue ? "border-red-200 bg-red-50 text-red-900" : "border-stone-200 bg-stone-50 text-stone-700"}>{selectedAppeal.slaOverdue ? "已超过处理时限" : adminStateLabel(selectedAppeal.state)}</Badge>
              </div>
              <blockquote className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {selectedAppeal.userStatement}
              </blockquote>
              <p className="mt-3 text-xs text-stone-500">关联限制 {selectedAppeal.sanctionId.slice(0, 8)} · 截止时间 {formatDate(selectedAppeal.firstResponseDueAt)}</p>
            </section>
          ) : null}

          {subject && canApply ? (
            <form
              id="moderation-sanction-form"
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              onSubmit={(event) => {
                event.preventDefault();
                if (!effectiveAccountId || !sanctionDraft.reasonCode.trim() || !sanctionDraft.internal.trim() || !sanctionDraft.visible.trim()) return;
                setPendingSanction({ accountId: effectiveAccountId, draft: { ...sanctionDraft } });
              }}
            >
              <h2 className="text-lg font-bold text-stone-950">执行限制</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">此操作会改变账号的实际使用权限。请先核对处理记录，再填写对用户可见的解释与内部依据。</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">限制类型
                  <NativeSelect aria-label="限制类型" value={sanctionDraft.kind} onChange={(event) => setSanctionDraft((draft) => ({ ...draft, kind: event.target.value as SanctionDraft["kind"] }))} className="min-h-10 bg-white font-normal">
                    <NativeSelectOption value="warning">警告</NativeSelectOption><NativeSelectOption value="submission_restricted">禁止提交</NativeSelectOption><NativeSelectOption value="attachment_restricted">禁止附件</NativeSelectOption><NativeSelectOption value="notification_restricted">限制通知</NativeSelectOption><NativeSelectOption value="account_suspended">暂停账号</NativeSelectOption><NativeSelectOption value="account_closed_for_abuse">违规关闭账号</NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className="grid gap-1 text-sm font-semibold">原因代码<Input aria-label="限制原因代码" value={sanctionDraft.reasonCode} onChange={(event) => setSanctionDraft((draft) => ({ ...draft, reasonCode: event.target.value }))} className="h-10 bg-white font-mono text-sm font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">截止时间 <span className="font-normal text-stone-500">(可选)</span><Input aria-label="限制截止时间" type="datetime-local" value={sanctionDraft.endsAt} onChange={(event) => setSanctionDraft((draft) => ({ ...draft, endsAt: event.target.value }))} className="h-10 bg-white font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">内部处理说明<Textarea aria-label="限制内部说明" value={sanctionDraft.internal} onChange={(event) => setSanctionDraft((draft) => ({ ...draft, internal: event.target.value }))} className="min-h-24 bg-white font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">告知用户的说明<Textarea aria-label="限制用户说明" value={sanctionDraft.visible} onChange={(event) => setSanctionDraft((draft) => ({ ...draft, visible: event.target.value }))} className="min-h-24 bg-white font-normal" /></label>
                <Button type="submit" disabled={busy || !sanctionDraft.reasonCode.trim() || !sanctionDraft.internal.trim() || !sanctionDraft.visible.trim()}>执行限制</Button>
              </div>
            </form>
          ) : null}

          <AlertDialog open={Boolean(pendingSanction)} onOpenChange={(open) => { if (!open) setPendingSanction(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认{sanctionActionLabels[pendingSanction?.draft.kind ?? "warning"]}？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作会对以下账号记录处理措施，并可能立即改变其使用权限。请核对账号 ID 和限制类型后再确认。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950">
                <p>账号 ID：<span className="break-all font-mono">{pendingSanction?.accountId}</span></p>
                <p>措施：{sanctionActionLabels[pendingSanction?.draft.kind ?? "warning"]}</p>
                <p>原因代码：{pendingSanction?.draft.reasonCode}</p>
                <p>截止时间：{pendingSanction?.draft.endsAt ? formatDate(new Date(pendingSanction.draft.endsAt).toISOString()) : "未设置"}</p>
                <p className="max-h-24 overflow-y-auto break-words">告知用户：{pendingSanction?.draft.visible}</p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-700 text-white hover:bg-red-800"
                  onClick={() => {
                    if (!pendingSanction) return;
                    applyMutation.mutate({
                      accountId: pendingSanction.accountId,
                      input: {
                        kind: pendingSanction.draft.kind,
                        reasonCode: pendingSanction.draft.reasonCode.trim(),
                        internalExplanation: pendingSanction.draft.internal.trim(),
                        userVisibleExplanation: pendingSanction.draft.visible.trim(),
                        idempotencyKey: crypto.randomUUID(),
                        ...(pendingSanction.draft.endsAt ? { endsAt: new Date(pendingSanction.draft.endsAt).toISOString() } : {}),
                      },
                    });
                  }}
                >确认{sanctionActionLabels[pendingSanction?.draft.kind ?? "warning"]}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {subject && canRestore && restoreDraft.sanctionId ? (
            <form
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              onSubmit={(event) => {
                event.preventDefault();
                if (!restoreDraft.reasonCode.trim() || !restoreDraft.internal.trim() || !restoreDraft.visible.trim()) return;
                restoreMutation.mutate({
                  sanctionId: restoreDraft.sanctionId,
                  input: {
                    reasonCode: restoreDraft.reasonCode.trim(),
                    internalExplanation: restoreDraft.internal.trim(),
                    userVisibleExplanation: restoreDraft.visible.trim(),
                    idempotencyKey: crypto.randomUUID(),
                  },
                });
              }}
            >
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-stone-950">解除限制</h2><p className="mt-1 font-mono text-xs text-stone-500">{restoreDraft.sanctionId}</p></div><Button type="button" variant="outline" size="sm" onClick={() => setRestoreDraft(initialRestoreDraft)}>取消</Button></div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">原因代码<Input aria-label="解除原因代码" value={restoreDraft.reasonCode} onChange={(event) => setRestoreDraft((draft) => ({ ...draft, reasonCode: event.target.value }))} className="h-10 bg-white font-mono text-sm font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">内部处理说明<Textarea aria-label="解除内部说明" value={restoreDraft.internal} onChange={(event) => setRestoreDraft((draft) => ({ ...draft, internal: event.target.value }))} className="min-h-24 bg-white font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">告知用户的说明<Textarea aria-label="解除用户说明" value={restoreDraft.visible} onChange={(event) => setRestoreDraft((draft) => ({ ...draft, visible: event.target.value }))} className="min-h-24 bg-white font-normal" /></label>
                <Button type="submit" disabled={busy || !restoreDraft.reasonCode.trim() || !restoreDraft.internal.trim() || !restoreDraft.visible.trim()}>解除限制</Button>
              </div>
            </form>
          ) : null}

          {selectedAppeal && selectedAppeal.state !== "closed" && canDecideAppeal ? (
            <form
              id="moderation-appeal-decision"
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              onSubmit={(event) => {
                event.preventDefault();
                if (!appealDraft.internal.trim() || !appealDraft.visible.trim()) return;
                decideAppealMutation.mutate({
                  appealCaseId: selectedAppeal.appealCaseId,
                  input: {
                    outcome: appealDraft.outcome,
                    internalExplanation: appealDraft.internal.trim(),
                    userVisibleExplanation: appealDraft.visible.trim(),
                  },
                });
              }}
            >
              <h2 className="text-lg font-bold text-stone-950">处理申诉</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">处理结果
                  <NativeSelect aria-label="申诉处理结果" value={appealDraft.outcome} onChange={(event) => setAppealDraft((draft) => ({ ...draft, outcome: event.target.value as AppealDraft["outcome"] }))} className="min-h-10 bg-white font-normal">
                    <NativeSelectOption value="upheld">维持原决定</NativeSelectOption><NativeSelectOption value="modified">调整决定</NativeSelectOption><NativeSelectOption value="overturned">撤销决定</NativeSelectOption><NativeSelectOption value="dismissed">驳回申诉</NativeSelectOption>
                  </NativeSelect>
                </label>
                <label className="grid gap-1 text-sm font-semibold">内部处理说明<Textarea aria-label="申诉内部说明" value={appealDraft.internal} onChange={(event) => setAppealDraft((draft) => ({ ...draft, internal: event.target.value }))} className="min-h-24 bg-white font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">告知用户的说明<Textarea aria-label="申诉用户说明" value={appealDraft.visible} onChange={(event) => setAppealDraft((draft) => ({ ...draft, visible: event.target.value }))} className="min-h-24 bg-white font-normal" /></label>
                <Button type="submit" disabled={busy || !appealDraft.internal.trim() || !appealDraft.visible.trim()}>保存申诉决定</Button>
              </div>
            </form>
          ) : null}
        </div>
      </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
