"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/table/data-table";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import {
  reviewKeys,
  reviewMutationOptions,
  reviewQueueQueryOptions,
  reviewSurfaceQueryOptions,
} from "../api/queries";
import { REVIEW_STATES, type ReviewCaseQueueItem, type ReviewState } from "../api/types";
import {
  ADMIN_QUEUE_PAGE_SIZE,
  adminStateLabel,
  formatQueueAge,
  hasAdminCapability,
  reviewDisplayValue,
  reviewFieldLabel,
} from "../presentation";

const reviewColumnHelper = createColumnHelper<ReviewCaseQueueItem>();
type ReviewPanel = "evidence" | "verify" | "decide" | "recommend";

export function ReviewQueueWorkspace() {
  const queryClient = useQueryClient();
  const session = useQuery(adminSessionQueryOptions);
  const capabilities = session.data?.capabilities;
  const canRead = hasAdminCapability(capabilities, "review.case.read");
  const canIntake = hasAdminCapability(capabilities, "review.case.intake");
  const canClaim = hasAdminCapability(capabilities, "review.case.claim");
  const canVerify = hasAdminCapability(capabilities, "review.case.verify_source");
  const canDecide = hasAdminCapability(capabilities, "review.case.decide");
  const canRecommend = hasAdminCapability(capabilities, "review.case.recommend");

  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: true }));
  const [state, setState] = useQueryState("state", { shallow: true });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [panel, setPanel] = useState<ReviewPanel>("evidence");
  const normalizedState = REVIEW_STATES.includes(state as ReviewState) ? state as ReviewState : undefined;
  const queueQuery = {
    limit: ADMIN_QUEUE_PAGE_SIZE,
    offset: Math.max(0, page - 1) * ADMIN_QUEUE_PAGE_SIZE,
    ...(normalizedState ? { state: normalizedState } : {}),
  };
  const queue = useQuery({ ...reviewQueueQueryOptions(queueQuery), enabled: canRead });
  const effectiveCaseId = selectedCaseId ?? queue.data?.items[0]?.reviewCaseId;
  const surface = useQuery({
    ...reviewSurfaceQueryOptions(effectiveCaseId ?? ""),
    enabled: canRead && Boolean(effectiveCaseId),
  });

  const [submissionId, setSubmissionId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceOutcome, setSourceOutcome] = useState<"verified" | "rejected">("verified");
  const [normalizedLocator, setNormalizedLocator] = useState("");
  const [canonicalSourceId, setCanonicalSourceId] = useState("");
  const [sourceReason, setSourceReason] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState<"accepted" | "not_accepted" | "duplicate" | "out_of_scope" | "abuse">("accepted");
  const [selectedAssertionKeys, setSelectedAssertionKeys] = useState<string[]>([]);
  const [userVisibleExplanation, setUserVisibleExplanation] = useState("");
  const [internalReason, setInternalReason] = useState("");
  const [duplicateOfReviewCaseId, setDuplicateOfReviewCaseId] = useState("");
  const [recommendReason, setRecommendReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setPanel("evidence");
    setSourceId("");
    setNormalizedLocator("");
    setCanonicalSourceId("");
    setSourceReason("");
    setSelectedAssertionKeys([]);
    setUserVisibleExplanation("");
    setInternalReason("");
    setDuplicateOfReviewCaseId("");
    setRecommendReason("");
    setNotice(null);
  }, [effectiveCaseId]);

  const refreshQueue = async () => {
    await queryClient.invalidateQueries({ queryKey: reviewKeys.queues });
  };

  const refreshCase = async (reviewCaseId: string) => {
    await Promise.all([
      refreshQueue(),
      queryClient.invalidateQueries({ queryKey: reviewKeys.surface(reviewCaseId) }),
    ]);
  };

  const openMutation = useMutation({
    ...reviewMutationOptions.open(),
    onSuccess: async (reviewCase) => {
      setSubmissionId("");
      setNotice(`已建立审核案件 ${reviewCase.reviewCaseId}。`);
      setSelectedCaseId(reviewCase.reviewCaseId);
      await refreshQueue();
    },
  });
  const claimMutation = useMutation({
    ...reviewMutationOptions.claim(),
    onSuccess: async (_reviewCase, reviewCaseId) => {
      setNotice("案件已领取。");
      await refreshCase(reviewCaseId);
    },
  });
  const verifyMutation = useMutation({
    ...reviewMutationOptions.verifySource(),
    onSuccess: async (_result, variables) => {
      setSourceReason("");
      setCanonicalSourceId("");
      setNotice("来源核验结果已记录。");
      await refreshCase(variables.reviewCaseId);
    },
  });
  const decideMutation = useMutation({
    ...reviewMutationOptions.decide(),
    onSuccess: async (_result, variables) => {
      setNotice("审核决定已记录。");
      await refreshCase(variables.reviewCaseId);
    },
  });
  const recommendMutation = useMutation({
    ...reviewMutationOptions.recommend(),
    onSuccess: async (recommendation, variables) => {
      setNotice(`已提交策展变更集 ${recommendation.changeSetId}。`);
      setRecommendReason("");
      await refreshCase(variables.reviewCaseId);
    },
  });

  const columns = useMemo(() => [
    reviewColumnHelper.accessor("reviewCaseId", {
      header: "案件",
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left font-semibold text-stone-950 underline decoration-stone-400 underline-offset-4"
          onClick={() => setSelectedCaseId(row.original.reviewCaseId)}
        >
          <span className="block">{row.original.targetPandaId ? `熊猫编号 ${row.original.targetPandaId.slice(0, 8)}` : "尚未关联熊猫"}</span>
          <span className="mt-1 block text-xs font-normal text-stone-600">案件 {row.original.reviewCaseId.slice(0, 8)}</span>
        </button>
      ),
    }),
    reviewColumnHelper.accessor("state", {
      header: "状态",
      cell: ({ getValue }) => <span className="capitalize">{adminStateLabel(getValue())}</span>,
    }),
    reviewColumnHelper.accessor("queueAgeSeconds", {
      header: "等待情况",
      cell: ({ row, getValue }) => <span className={row.original.slaOverdue ? "font-semibold text-red-700" : "text-stone-700"}>{formatQueueAge(getValue())}{row.original.slaOverdue ? " · 已超时" : ""}</span>,
    }),
  ], [setSelectedCaseId]);
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: queue.data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  const totalPages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / ADMIN_QUEUE_PAGE_SIZE));
  const selected = surface.data;
  const contribution = selected?.contribution;
  const ownsSelectedCase = selected?.reviewCase.primaryAssigneeId === session.data?.accountId;
  const selectedSource = contribution?.sources.find((item) => item.sourceId === sourceId) ?? contribution?.sources[0];
  const mutationError = openMutation.error
    ?? claimMutation.error
    ?? verifyMutation.error
    ?? decideMutation.error
    ?? recommendMutation.error;
  const busy = openMutation.isPending
    || claimMutation.isPending
    || verifyMutation.isPending
    || decideMutation.isPending
    || recommendMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-[1480px] px-6 pb-12 pt-9 md:px-9">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">贡献审核队列</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
            核对贡献证据、验证来源、记录审核决定，并将通过的资料交接给策展工作区。
          </p>
        </div>
        {canRead ? (
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            队列状态
            <NativeSelect
              aria-label="队列状态"
              value={normalizedState ?? "all"}
              onChange={(event) => {
                const value = event.target.value;
                void setState(value === "all" ? null : value);
                void setPage(1);
              }}
              className="min-h-10 min-w-36 border-slate-300 bg-white text-slate-900"
            >
              <NativeSelectOption value="all">全部</NativeSelectOption>
              {REVIEW_STATES.map((value) => <NativeSelectOption key={value} value={value}>{adminStateLabel(value)}</NativeSelectOption>)}
            </NativeSelect>
          </label>
        ) : null}
      </div>

      {canIntake ? (
        <Collapsible className="group mt-5 rounded-xl border border-slate-200 bg-white">
          <CollapsibleTrigger className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-5 text-left text-sm font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">
            通过提交编号创建审核案件
            <ChevronDown size={17} aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        <CollapsibleContent><form
          className="flex flex-wrap items-end gap-3 border-t border-slate-100 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (submissionId.trim()) openMutation.mutate({ submissionId: submissionId.trim() });
          }}
        >
          <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold text-stone-800">
            录入待审核贡献
            <Input
              aria-label="贡献提交 ID"
              value={submissionId}
              onChange={(event) => setSubmissionId(event.target.value)}
              placeholder="输入贡献提交 UUID"
              className="h-10 bg-white font-mono text-sm font-normal"
            />
          </label>
          <Button type="submit" disabled={busy || !submissionId.trim()}>创建审核案件</Button>
        </form></CollapsibleContent>
        </Collapsible>
      ) : null}

      {mutationError ? (
        <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{mutationError.message}</p>
      ) : null}
      {notice ? <p role="status" className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p> : null}

      <ResizablePanelGroup orientation="horizontal" className="mt-5 min-h-[680px] items-stretch">
        <ResizablePanel defaultSize="36%" minSize="28%" maxSize="55%" className="min-w-0">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" aria-label="待办队列" aria-labelledby="review-queue-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="review-queue-heading" className="text-base font-semibold text-slate-950">待办队列</h2>
              <p className="mt-1 text-xs text-slate-600">选择案件查看资料、证据和处理进度</p>
            </div>
            {queue.data ? <Badge variant="outline" className="bg-white text-slate-700">{queue.data.total} 件</Badge> : null}
          </div>
          {!canRead ? <p className="mt-5 text-sm text-stone-600">当前账号没有查看审核队列的权限。</p> : null}
          {queue.isPending && canRead ? <div role="status" aria-label="正在加载审核队列" className="mt-5 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : null}
          {queue.isError ? <div role="alert" className="mt-5 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{queue.error.message}</p><Button variant="outline" size="sm" onClick={() => void queue.refetch()}>重试加载队列</Button></div> : null}
          {queue.isSuccess ? (
            <>
              <ScrollArea className={queue.data.items.length > 7 ? "mt-4 h-[min(60vh,720px)] rounded-xl" : "mt-4 rounded-xl"}><DataTable table={table} emptyMessage="当前筛选条件下没有待审核案件。" /></ScrollArea>
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
        <ResizableHandle withHandle aria-label="调整队列与详情宽度" className="mx-2 w-1 rounded-full bg-slate-200 transition-colors hover:bg-teal-400 focus-visible:bg-teal-400 [&>div]:h-10 [&>div]:w-3 [&>div]:rounded-full [&>div]:border-slate-300 [&>div]:bg-white" />
        <ResizablePanel defaultSize="64%" minSize="45%" className="min-w-0">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs" aria-label="审核案件详情">
            {surface.isPending && effectiveCaseId ? <div role="status" aria-label="正在加载案件详情" className="space-y-4 p-6"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-20 w-full" /><Skeleton className="h-24 w-full" /></div> : null}
            {surface.isError ? <div role="alert" className="space-y-3 p-5 text-sm text-red-800"><p>{surface.error.message}</p><Button variant="outline" size="sm" onClick={() => void surface.refetch()}>重新加载案件详情</Button></div> : null}
            {!effectiveCaseId && queue.isSuccess ? <Empty className="min-h-[540px]"><EmptyHeader><EmptyMedia variant="icon"><ClipboardCheck aria-hidden="true" /></EmptyMedia><EmptyTitle><h2>请选择审核案件</h2></EmptyTitle><EmptyDescription>从左侧队列选择案件，查看事实、证据和需要完成的核验操作。</EmptyDescription></EmptyHeader></Empty> : null}
            {selected ? (
              <>
                <div className="border-b border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 id="review-detail-heading" className="text-lg font-semibold text-slate-950">{panel === "evidence" ? "事实与证据" : "案件处理"}</h2>
                      <p className="mt-1 text-sm text-slate-600">{panel === "evidence" ? "先核对提交事实与原始资料，再决定是否接受。" : "一次只处理一项操作，切换操作不会清空当前输入。"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className="border-slate-300 bg-white text-slate-800">{adminStateLabel(selected.reviewCase.state)}</Badge>
                      {canClaim && !selected.reviewCase.primaryAssigneeId && ["new", "triage", "waiting"].includes(selected.reviewCase.state) ? (
                        <Button type="button" size="sm" disabled={busy} onClick={() => claimMutation.mutate(selected.reviewCase.reviewCaseId)}>领取案件</Button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 border-b border-stone-200 p-5 sm:grid-cols-3">
                  <div><p className="text-xs font-semibold text-stone-600">关联熊猫档案</p><p className="mt-1 break-all text-sm font-semibold">{contribution?.targetPandaId ? `编号 ${contribution.targetPandaId.slice(0, 8)}` : "—"}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-stone-500">修订版本</p><p className="mt-1 text-sm font-semibold">{selected.reviewCase.revisionNumber}</p></div>
                  <div><p className="text-xs font-semibold text-stone-600">审核负责人</p><p className="mt-1 break-all text-sm font-semibold">{selected.reviewCase.primaryAssigneeId === session.data?.accountId ? "我" : selected.reviewCase.primaryAssigneeId ? "其他工作人员" : "待领取"}</p></div>
                </div>
                <Tabs value={panel} onValueChange={(value) => setPanel(value as ReviewPanel)} className="gap-0">
                <TabsList variant="line" aria-label="案件查看与操作" className="flex h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-b border-slate-200 bg-slate-50 px-5 py-2">
                  {([
                    { id: "evidence", label: "查看证据", enabled: true },
                    { id: "verify", label: "核验来源", enabled: canVerify && Boolean(contribution?.sources.length) },
                    { id: "decide", label: "审核决定", enabled: canDecide && Boolean(contribution) },
                    { id: "recommend", label: "策展交接", enabled: canRecommend },
                  ] as const).filter((item) => item.enabled).map((item) => (
                    <TabsTrigger
                      key={item.id}
                      value={item.id}
                      className="min-h-10 flex-none px-3 text-slate-700 data-[state=active]:font-semibold data-[state=active]:text-teal-800"
                    >
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value="evidence" className="space-y-5 p-5">
                  <div>
                    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-950">待核验事实</h3><span className="text-xs text-slate-600">{contribution?.assertions.length ?? 0} 项</span></div>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {contribution?.assertions.map((assertion) => (
                        <li key={assertion.assertionKey} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="text-xs text-slate-600">{reviewFieldLabel(assertion.fieldKey)}</p>
                            <p className="mt-1 break-words text-sm font-semibold text-slate-950">{reviewDisplayValue(assertion.fieldKey, assertion.value)}</p>
                          </div>
                          <div className="flex items-center gap-2"><span className="text-xs text-slate-600">来源 {assertion.sourceIds.length} 项</span><Badge variant="outline" className="bg-white text-slate-700">{adminStateLabel(assertion.certainty)}</Badge></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-950">证据来源</h3><span className="text-xs text-slate-600">{contribution?.sources.length ?? 0} 项</span></div>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {contribution?.sources.map((source) => (
                        <li key={source.sourceId} className="px-4 py-3">
                          <p className="text-sm font-semibold text-stone-950">{source.title}</p>
                          {source.publisher && <p className="mt-1 text-xs text-stone-600">发布机构：{source.publisher}</p>}
                          <Collapsible className="mt-1 text-xs text-slate-600"><CollapsibleTrigger className="min-h-8 text-teal-800 focus-visible:outline-2">查看来源地址</CollapsibleTrigger><CollapsibleContent><p className="mt-1 break-all">{source.locator}</p></CollapsibleContent></Collapsible>
                          {source.sourceKind === "url" && /^https?:\/\//i.test(source.locator) && (
                            <a href={source.locator} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">查看机构原文</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {selected.reviewCase.primaryAssigneeId === session.data?.accountId && selected.reviewCase.state === "assigned" && (
                    <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-950">此案件由你负责，请继续核验来源并作出审核决定。</p>
                  )}
                  {selected.reviewCase.primaryAssigneeId && selected.reviewCase.primaryAssigneeId !== session.data?.accountId && (
                    <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">此案件已有负责人，你可以查看证据，但不能直接领取。</p>
                  )}
                  <Collapsible className="text-sm text-slate-600">
                    <CollapsibleTrigger className="min-h-9 font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2">查看案件及关联对象编号</CollapsibleTrigger>
                    <CollapsibleContent><dl className="mt-2 space-y-1 break-all font-mono text-xs">
                      <div><dt className="inline font-sans">案件 ID：</dt><dd className="inline">{selected.reviewCase.reviewCaseId}</dd></div>
                      {contribution?.targetPandaId && <div><dt className="inline font-sans">熊猫 ID：</dt><dd className="inline">{contribution.targetPandaId}</dd></div>}
                      {selected.reviewCase.primaryAssigneeId && <div><dt className="inline font-sans">负责人 ID：</dt><dd className="inline">{selected.reviewCase.primaryAssigneeId}</dd></div>}
                      {contribution?.assertions.map((assertion) => (
                        <div key={assertion.assertionKey}><dt className="inline font-sans">事实字段：</dt><dd className="inline">{assertion.fieldKey} · {assertion.assertionKey}</dd></div>
                      ))}
                      {contribution?.sources.map((source) => (
                        <div key={source.sourceId}><dt className="inline font-sans">来源 ID：</dt><dd className="inline">{source.sourceId}</dd></div>
                      ))}
                    </dl></CollapsibleContent>
                  </Collapsible>
                </TabsContent>
          {canVerify && contribution?.sources.length ? (
            <TabsContent value="verify" className="p-5">
              <h4 className="mb-1 text-sm font-semibold text-slate-950">核验来源</h4>
              <p className="mb-4 text-xs text-slate-600">核实机构原文与提交事实是否一致</p>
            <form
              className="space-y-3 border-t border-slate-100 px-5 pb-5 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!selectedSource || !sourceReason.trim()) return;
                verifyMutation.mutate({
                  reviewCaseId: selected.reviewCase.reviewCaseId,
                  input: {
                    sourceId: selectedSource.sourceId,
                    outcome: sourceOutcome,
                    reason: sourceReason.trim(),
                    ...(sourceOutcome === "verified" && normalizedLocator.trim() ? { normalizedLocator: normalizedLocator.trim() } : {}),
                    ...(sourceOutcome === "verified" && canonicalSourceId.trim() ? { canonicalSourceId: canonicalSourceId.trim() } : {}),
                  },
                });
              }}
            >
              <p className="text-sm leading-6 text-slate-600">核验通过时，请填写正式来源 ID 和规范化地址。</p>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">来源
                  <NativeSelect aria-label="证据来源" value={selectedSource?.sourceId ?? ""} onChange={(event) => setSourceId(event.target.value)} className="min-h-10 bg-white font-normal">
                    {contribution.sources.map((source) => <NativeSelectOption key={source.sourceId} value={source.sourceId}>{source.title}</NativeSelectOption>)}
                  </NativeSelect>
                </label>
                <label className="grid gap-1 text-sm font-semibold">核验结果
                  <NativeSelect aria-label="来源核验结果" value={sourceOutcome} onChange={(event) => setSourceOutcome(event.target.value as "verified" | "rejected")} className="min-h-10 bg-white font-normal">
                    <NativeSelectOption value="verified">已核验</NativeSelectOption><NativeSelectOption value="rejected">已驳回</NativeSelectOption>
                  </NativeSelect>
                </label>
                {sourceOutcome === "verified" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">规范化来源地址（必填）<Input aria-label="规范化来源地址" required value={normalizedLocator} onChange={(event) => setNormalizedLocator(event.target.value)} className="h-10 bg-white font-normal" /></label>
                    <label className="grid gap-1 text-sm font-semibold">正式来源 ID（必填）<Input aria-label="正式来源 ID" required value={canonicalSourceId} onChange={(event) => setCanonicalSourceId(event.target.value)} className="h-10 bg-white font-mono text-xs font-normal" /></label>
                  </div>
                ) : null}
                <label className="grid gap-1 text-sm font-semibold">原因<Textarea aria-label="来源核验原因" value={sourceReason} onChange={(event) => setSourceReason(event.target.value)} className="min-h-24 bg-white font-normal" /></label>
                <Button type="submit" disabled={busy || !sourceReason.trim() || (sourceOutcome === "verified" && (!normalizedLocator.trim() || !canonicalSourceId.trim()))}>保存核验结果</Button>
              </div>
            </form>
            </TabsContent>
          ) : null}

          {canDecide && contribution ? (
            <TabsContent value="decide" className="p-5">
              {selected.reviewCase.primaryAssigneeId && !ownsSelectedCase && (
                <p className="mb-4 text-sm text-slate-600">当前案件由其他工作人员负责。审核决定只能由当前负责人保存。</p>
              )}
              <h4 className="mb-1 text-sm font-semibold text-slate-950">审核决定</h4>
              <p className="mb-4 text-xs text-slate-600">选择审核结果，并向贡献者说明理由</p>
            <form
              className="space-y-3 border-t border-slate-100 px-5 pb-5 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!userVisibleExplanation.trim()) return;
                decideMutation.mutate({
                  reviewCaseId: selected.reviewCase.reviewCaseId,
                  input: {
                    outcome: decisionOutcome,
                    selectedAssertionKeys,
                    userVisibleExplanation: userVisibleExplanation.trim(),
                    ...(internalReason.trim() ? { internalReason: internalReason.trim() } : {}),
                    ...(decisionOutcome === "duplicate" && duplicateOfReviewCaseId.trim() ? { duplicateOfReviewCaseId: duplicateOfReviewCaseId.trim() } : {}),
                  },
                });
              }}
            >
              <p className="text-sm leading-6 text-slate-600">只有当前负责人可以保存决定；请根据上方事实与来源核验结果填写。</p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                <label className="grid gap-1 text-sm font-semibold">审核结果
                  <NativeSelect aria-label="审核决定类型" value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value as typeof decisionOutcome)} className="min-h-10 bg-white font-normal">
                    <NativeSelectOption value="accepted">接受</NativeSelectOption><NativeSelectOption value="not_accepted">不接受</NativeSelectOption><NativeSelectOption value="duplicate">重复</NativeSelectOption><NativeSelectOption value="out_of_scope">超出范围</NativeSelectOption><NativeSelectOption value="abuse">滥用</NativeSelectOption>
                  </NativeSelect>
                </label>
                <fieldset>
                  <legend className="text-sm font-semibold">纳入本次审核的事实</legend>
                  {contribution.assertions.length > 4 ? <p className="mt-1 text-xs font-normal text-slate-600">可在下方列表内滚动，逐项选择需要纳入的事实。</p> : null}
                  <ScrollArea
                    tabIndex={contribution.assertions.length > 4 ? 0 : undefined}
                    aria-label={contribution.assertions.length > 4 ? "可滚动的审核事实列表" : undefined}
                    className="mt-2 max-h-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <div className="grid gap-2 pr-3">{contribution.assertions.map((assertion) => (
                      <label key={assertion.assertionKey} className="flex items-start gap-2 rounded-md border border-stone-200 p-3 text-sm">
                        <Checkbox
                          aria-label={reviewFieldLabel(assertion.fieldKey)}
                          checked={selectedAssertionKeys.includes(assertion.assertionKey)}
                          onCheckedChange={(checked) => setSelectedAssertionKeys((current) => checked === true ? [...current, assertion.assertionKey] : current.filter((key) => key !== assertion.assertionKey))}
                        />
                        <span><strong>{reviewFieldLabel(assertion.fieldKey)}</strong><span className="mt-1 block text-xs text-stone-600">{reviewDisplayValue(assertion.fieldKey, assertion.value)}</span></span>
                      </label>
                    ))}</div>
                  </ScrollArea>
                </fieldset>
                </div>
                <div className="space-y-3">
                {decisionOutcome === "duplicate" ? <label className="grid gap-1 text-sm font-semibold">重复案件 ID<Input aria-label="重复案件 ID" value={duplicateOfReviewCaseId} onChange={(event) => setDuplicateOfReviewCaseId(event.target.value)} className="h-10 bg-white font-mono text-xs font-normal" /></label> : null}
                <label className="grid gap-1 text-sm font-semibold">给贡献者的说明<Textarea aria-label="给贡献者的说明" value={userVisibleExplanation} onChange={(event) => setUserVisibleExplanation(event.target.value)} className="min-h-24 bg-white font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">内部处理原因<Textarea aria-label="内部处理原因" value={internalReason} onChange={(event) => setInternalReason(event.target.value)} className="min-h-20 bg-white font-normal" /></label>
                <Button type="submit" disabled={busy || !ownsSelectedCase || !userVisibleExplanation.trim()}>保存审核决定</Button>
                </div>
              </div>
            </form>
            </TabsContent>
          ) : null}

          {canRecommend ? (
            <TabsContent value="recommend" className="p-5">
              <h4 className="mb-1 text-sm font-semibold text-slate-950">策展交接</h4>
              <p className="mb-4 text-xs text-slate-600">将已通过且有可信来源支持的事实推荐给策展人员</p>
            <form
              className="space-y-3 border-t border-slate-100 px-5 pb-5 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!recommendReason.trim()) return;
                recommendMutation.mutate({ reviewCaseId: selected.reviewCase.reviewCaseId, input: { reason: recommendReason.trim() } });
              }}
            >
              <p className="text-sm text-slate-600">仅可推荐有可信来源支持且审核通过的事实。</p>
              <label className="mt-4 grid gap-1 text-sm font-semibold">推荐理由<Textarea aria-label="推荐理由" value={recommendReason} onChange={(event) => setRecommendReason(event.target.value)} className="min-h-20 bg-white font-normal" /></label>
              <Button type="submit" className="mt-3" disabled={busy || !recommendReason.trim()}>提交策展</Button>
            </form>
            </TabsContent>
          ) : null}
                </Tabs>
              </>
            ) : null}
          </section>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
