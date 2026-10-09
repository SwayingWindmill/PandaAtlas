"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">审核</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">贡献审核队列</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            核对贡献证据、验证来源、记录审核决定，并将通过的资料交接给策展工作区。
          </p>
        </div>
        {canRead ? (
          <label className="text-sm font-semibold text-stone-700">
            队列状态
            <select
              aria-label="队列状态"
              value={normalizedState ?? "all"}
              onChange={(event) => {
                const value = event.target.value;
                void setState(value === "all" ? null : value);
                void setPage(1);
              }}
              className="ml-2 min-h-10 rounded-md border border-stone-400 bg-white px-3 capitalize"
            >
              <option value="all">全部</option>
              {REVIEW_STATES.map((value) => <option key={value} value={value}>{adminStateLabel(value)}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      {canIntake ? (
        <form
          className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-stone-300 bg-white p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (submissionId.trim()) openMutation.mutate({ submissionId: submissionId.trim() });
          }}
        >
          <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold text-stone-800">
            录入待审核贡献
            <input
              aria-label="贡献提交 ID"
              value={submissionId}
              onChange={(event) => setSubmissionId(event.target.value)}
              placeholder="输入贡献提交 UUID"
              className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-sm font-normal"
            />
          </label>
          <Button type="submit" disabled={busy || !submissionId.trim()}>创建审核案件</Button>
        </form>
      ) : null}

      {mutationError ? (
        <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{mutationError.message}</p>
      ) : null}
      {notice ? <p role="status" className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p> : null}

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(23rem,0.8fr)_minmax(0,1.5fr)]">
        <section className="min-w-0 rounded-xl border border-stone-300 bg-white p-5 shadow-sm xl:sticky xl:top-24" aria-labelledby="review-queue-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="review-queue-heading" className="text-xl font-bold text-stone-950">待办队列</h2>
              <p className="mt-1 text-sm text-stone-600">选择案件查看资料、证据和处理进度。</p>
            </div>
            {queue.data ? <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">{queue.data.total} 件</span> : null}
          </div>
          {!canRead ? <p className="mt-5 text-sm text-stone-600">当前账号没有查看审核队列的权限。</p> : null}
          {queue.isPending && canRead ? <p className="mt-5 text-sm text-stone-600">正在加载审核队列…</p> : null}
          {queue.isError ? <p role="alert" className="mt-5 text-sm text-red-800">{queue.error.message}</p> : null}
          {queue.isSuccess ? (
            <>
              <div className="mt-5"><DataTable table={table} emptyMessage="当前筛选条件下没有待审核案件。" /></div>
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
          <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-labelledby="review-detail-heading">
            {surface.isPending && effectiveCaseId ? <p className="p-5 text-sm text-stone-600">正在加载案件详情…</p> : null}
            {surface.isError ? <p role="alert" className="p-5 text-sm text-red-800">{surface.error.message}</p> : null}
            {!effectiveCaseId && queue.isSuccess ? <p className="p-5 text-sm text-stone-600">请从队列中选择审核案件。</p> : null}
            {selected ? (
              <>
                <div className="border-b border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-teal-800">当前审核任务</p>
                      <h2 id="review-detail-heading" className="mt-2 text-xl font-semibold text-slate-950">案件详情与来源</h2>
                      <p className="mt-1 text-sm text-slate-600">先核对提交事实与原始资料，再决定是否接受。</p>
                    </div>
                    <Badge variant="outline" className="border-slate-300 bg-white text-slate-800">{adminStateLabel(selected.reviewCase.state)}</Badge>
                  </div>
                </div>
                <div className="grid gap-3 border-b border-stone-200 p-5 sm:grid-cols-3">
                  <div><p className="text-xs font-semibold text-stone-600">关联熊猫档案</p><p className="mt-1 break-all text-sm font-semibold">{contribution?.targetPandaId ? `编号 ${contribution.targetPandaId.slice(0, 8)}` : "—"}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-stone-500">修订版本</p><p className="mt-1 text-sm font-semibold">{selected.reviewCase.revisionNumber}</p></div>
                  <div><p className="text-xs font-semibold text-stone-600">审核负责人</p><p className="mt-1 break-all text-sm font-semibold">{selected.reviewCase.primaryAssigneeId === session.data?.accountId ? "我" : selected.reviewCase.primaryAssigneeId ? "其他工作人员" : "待领取"}</p></div>
                </div>
                <div className="space-y-5 p-5">
                  <details className="text-sm text-slate-600">
                    <summary className="cursor-pointer font-medium text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2">查看案件及关联对象编号</summary>
                    <dl className="mt-2 space-y-1 break-all font-mono text-xs">
                      <div><dt className="inline font-sans">案件 ID：</dt><dd className="inline">{selected.reviewCase.reviewCaseId}</dd></div>
                      {contribution?.targetPandaId && <div><dt className="inline font-sans">熊猫 ID：</dt><dd className="inline">{contribution.targetPandaId}</dd></div>}
                      {selected.reviewCase.primaryAssigneeId && <div><dt className="inline font-sans">负责人 ID：</dt><dd className="inline">{selected.reviewCase.primaryAssigneeId}</dd></div>}
                    </dl>
                  </details>
                  <div>
                    <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-stone-950">待核验事实</h3><span className="text-xs text-stone-500">{contribution?.assertions.length ?? 0}</span></div>
                    <ul className="mt-3 space-y-2">
                      {contribution?.assertions.map((assertion) => (
                        <li key={assertion.assertionKey}>
                          <Card className="gap-2 border-slate-200 bg-slate-50 py-3 shadow-none">
                            <CardContent>
                              <div className="flex items-start justify-between gap-3"><strong className="text-sm text-slate-950">{reviewFieldLabel(assertion.fieldKey)}</strong><Badge variant="outline" className="bg-white text-slate-700">{adminStateLabel(assertion.certainty)}</Badge></div>
                              <p className="mt-2 break-words text-base font-medium text-slate-900">{reviewDisplayValue(assertion.fieldKey, assertion.value)}</p>
                              <p className="mt-1 text-xs text-slate-600">来源 {assertion.sourceIds.length} 项 · 原始字段：{assertion.fieldKey}</p>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-stone-950">证据来源</h3><span className="text-xs text-stone-500">{contribution?.sources.length ?? 0}</span></div>
                    <ul className="mt-3 space-y-2">
                      {contribution?.sources.map((source) => (
                        <li key={source.sourceId} className="rounded-lg border border-stone-200 p-3">
                          <p className="text-sm font-semibold text-stone-950">{source.title}</p>
                          {source.publisher && <p className="mt-1 text-xs text-stone-600">发布机构：{source.publisher}</p>}
                          <p className="mt-1 break-all text-xs text-stone-600">{source.locator}</p>
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
                  {canClaim && !selected.reviewCase.primaryAssigneeId && ["new", "triage", "waiting"].includes(selected.reviewCase.state) ? (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => claimMutation.mutate(selected.reviewCase.reviewCaseId)}
                    >
                      领取案件
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>

          {selected && canVerify && contribution?.sources.length ? (
            <form
              className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm"
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
              <h2 className="text-lg font-bold text-stone-950">核验来源</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">先打开原始资料，确认内容与提交事实一致。核验通过时，需要提供正式来源及其规范化地址。</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">来源
                  <select aria-label="证据来源" value={selectedSource?.sourceId ?? ""} onChange={(event) => setSourceId(event.target.value)} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    {contribution.sources.map((source) => <option key={source.sourceId} value={source.sourceId}>{source.title}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">核验结果
                  <select aria-label="来源核验结果" value={sourceOutcome} onChange={(event) => setSourceOutcome(event.target.value as "verified" | "rejected")} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    <option value="verified">已核验</option><option value="rejected">已驳回</option>
                  </select>
                </label>
                {sourceOutcome === "verified" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">规范化来源地址（必填）<input aria-label="规范化来源地址" required value={normalizedLocator} onChange={(event) => setNormalizedLocator(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-normal" /></label>
                    <label className="grid gap-1 text-sm font-semibold">正式来源 ID（必填）<input aria-label="正式来源 ID" required value={canonicalSourceId} onChange={(event) => setCanonicalSourceId(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-xs font-normal" /></label>
                  </div>
                ) : null}
                <label className="grid gap-1 text-sm font-semibold">原因<textarea aria-label="来源核验原因" value={sourceReason} onChange={(event) => setSourceReason(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !sourceReason.trim() || (sourceOutcome === "verified" && (!normalizedLocator.trim() || !canonicalSourceId.trim()))}>保存核验结果</Button>
              </div>
            </form>
          ) : null}

          {selected && canDecide && contribution ? (
            <form
              className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm"
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
              <h2 className="text-lg font-bold text-stone-950">审核决定</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">案件负责人应在核对证据后选择结果，并向贡献者说明理由。只有当前负责人可以保存决定。</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">审核结果
                  <select aria-label="审核决定类型" value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value as typeof decisionOutcome)} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    <option value="accepted">接受</option><option value="not_accepted">不接受</option><option value="duplicate">重复</option><option value="out_of_scope">超出范围</option><option value="abuse">滥用</option>
                  </select>
                </label>
                <fieldset>
                  <legend className="text-sm font-semibold">纳入本次审核的事实</legend>
                  <div className="mt-2 grid gap-2">
                    {contribution.assertions.map((assertion) => (
                      <label key={assertion.assertionKey} className="flex items-start gap-2 rounded-md border border-stone-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedAssertionKeys.includes(assertion.assertionKey)}
                          onChange={(event) => setSelectedAssertionKeys((current) => event.target.checked ? [...current, assertion.assertionKey] : current.filter((key) => key !== assertion.assertionKey))}
                        />
                        <span><strong>{reviewFieldLabel(assertion.fieldKey)}</strong><span className="mt-1 block text-xs text-stone-600">{reviewDisplayValue(assertion.fieldKey, assertion.value)} · {assertion.assertionKey}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {decisionOutcome === "duplicate" ? <label className="grid gap-1 text-sm font-semibold">重复案件 ID<input aria-label="重复案件 ID" value={duplicateOfReviewCaseId} onChange={(event) => setDuplicateOfReviewCaseId(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-xs font-normal" /></label> : null}
                <label className="grid gap-1 text-sm font-semibold">给贡献者的说明<textarea aria-label="给贡献者的说明" value={userVisibleExplanation} onChange={(event) => setUserVisibleExplanation(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">内部处理原因<textarea aria-label="内部处理原因" value={internalReason} onChange={(event) => setInternalReason(event.target.value)} className="min-h-20 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !ownsSelectedCase || !userVisibleExplanation.trim()}>保存审核决定</Button>
              </div>
            </form>
          ) : null}

          {selected && canRecommend ? (
            <form
              className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (!recommendReason.trim()) return;
                recommendMutation.mutate({ reviewCaseId: selected.reviewCase.reviewCaseId, input: { reason: recommendReason.trim() } });
              }}
            >
              <h2 className="text-lg font-bold text-stone-950">策展交接</h2>
              <p className="mt-1 text-sm text-stone-600">仅可推荐已有可信来源支持且审核通过的事实。</p>
              <label className="mt-4 grid gap-1 text-sm font-semibold">推荐理由<textarea aria-label="推荐理由" value={recommendReason} onChange={(event) => setRecommendReason(event.target.value)} className="min-h-20 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
              <Button type="submit" className="mt-3" disabled={busy || !recommendReason.trim()}>提交策展</Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
