"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table/data-table";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import {
  reviewKeys,
  reviewMutationOptions,
  reviewQueueQueryOptions,
  reviewSurfaceQueryOptions,
} from "../api/queries";
import type { ReviewCaseQueueItem, ReviewState } from "../api/types";

const PAGE_SIZE = 25;
const reviewStates: readonly ReviewState[] = [
  "new",
  "triage",
  "assigned",
  "waiting",
  "decision_ready",
  "incorporation_recommended",
  "closed",
];
const reviewColumnHelper = createColumnHelper<ReviewCaseQueueItem>();

function formatAge(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

function hasCapability(capabilities: readonly string[] | undefined, capability: string): boolean {
  return capabilities?.includes(capability) ?? false;
}

function stateLabel(state: string): string {
  return state.replaceAll("_", " ");
}

export function ReviewQueueWorkspace() {
  const queryClient = useQueryClient();
  const session = useQuery(adminSessionQueryOptions);
  const capabilities = session.data?.capabilities;
  const canRead = hasCapability(capabilities, "review.case.read");
  const canIntake = hasCapability(capabilities, "review.case.intake");
  const canClaim = hasCapability(capabilities, "review.case.claim");
  const canVerify = hasCapability(capabilities, "review.case.verify_source");
  const canDecide = hasCapability(capabilities, "review.case.decide");
  const canRecommend = hasCapability(capabilities, "review.case.recommend");

  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: true }));
  const [state, setState] = useQueryState("state", { shallow: true });
  const [selectedCaseId, setSelectedCaseId] = useQueryState("case", { shallow: true });
  const normalizedState = reviewStates.includes(state as ReviewState) ? state as ReviewState : undefined;
  const queueQuery = { limit: PAGE_SIZE, offset: Math.max(0, page - 1) * PAGE_SIZE, ...(normalizedState ? { state: normalizedState } : {}) };
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

  const refreshReview = async () => {
    await queryClient.invalidateQueries({ queryKey: reviewKeys.all });
  };

  const openMutation = useMutation({
    ...reviewMutationOptions.open(),
    onSuccess: async (reviewCase) => {
      setSubmissionId("");
      setNotice(`Opened review case ${reviewCase.reviewCaseId}.`);
      await setSelectedCaseId(reviewCase.reviewCaseId);
      await refreshReview();
    },
  });
  const claimMutation = useMutation({
    ...reviewMutationOptions.claim(),
    onSuccess: async () => {
      setNotice("Review case claimed.");
      await refreshReview();
    },
  });
  const verifyMutation = useMutation({
    ...reviewMutationOptions.verifySource(),
    onSuccess: async () => {
      setSourceReason("");
      setCanonicalSourceId("");
      setNotice("Source verification recorded.");
      await refreshReview();
    },
  });
  const decideMutation = useMutation({
    ...reviewMutationOptions.decide(),
    onSuccess: async () => {
      setNotice("Review decision recorded.");
      await refreshReview();
    },
  });
  const recommendMutation = useMutation({
    ...reviewMutationOptions.recommend(),
    onSuccess: async (recommendation) => {
      setNotice(`Recommended to Curation as change set ${recommendation.changeSetId}.`);
      setRecommendReason("");
      await refreshReview();
    },
  });

  const columns = useMemo(() => [
    reviewColumnHelper.accessor("reviewCaseId", {
      header: "Case",
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left font-semibold text-stone-950 underline decoration-stone-400 underline-offset-4"
          onClick={() => void setSelectedCaseId(row.original.reviewCaseId)}
        >
          {row.original.reviewCaseId.slice(0, 8)}
        </button>
      ),
    }),
    reviewColumnHelper.accessor("state", {
      header: "State",
      cell: ({ getValue }) => <span className="capitalize">{stateLabel(getValue())}</span>,
    }),
    reviewColumnHelper.accessor("riskLevel", { header: "Risk" }),
    reviewColumnHelper.accessor("queueAgeSeconds", {
      header: "Age",
      cell: ({ getValue }) => formatAge(getValue()),
    }),
    reviewColumnHelper.accessor("slaOverdue", {
      header: "SLA",
      cell: ({ getValue }) => getValue()
        ? <span className="font-semibold text-red-700">Overdue</span>
        : <span className="text-stone-600">On track</span>,
    }),
  ], [setSelectedCaseId]);
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: queue.data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  const totalPages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / PAGE_SIZE));
  const selected = surface.data;
  const contribution = selected?.contribution;
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
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">Review</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">Contribution review queue</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            Triage submitted evidence, verify canonical sources, record a bounded decision, and hand accepted assertions to Curation.
          </p>
        </div>
        {canRead ? (
          <label className="text-sm font-semibold text-stone-700">
            Queue state
            <select
              aria-label="Queue state"
              value={normalizedState ?? "all"}
              onChange={(event) => {
                const value = event.target.value;
                void setState(value === "all" ? null : value);
                void setPage(1);
              }}
              className="ml-2 min-h-10 rounded-md border border-stone-400 bg-white px-3 capitalize"
            >
              <option value="all">All</option>
              {reviewStates.map((value) => <option key={value} value={value}>{stateLabel(value)}</option>)}
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
            Open submitted contribution
            <input
              aria-label="Submission ID"
              value={submissionId}
              onChange={(event) => setSubmissionId(event.target.value)}
              placeholder="Submission UUID"
              className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-sm font-normal"
            />
          </label>
          <Button type="submit" disabled={busy || !submissionId.trim()}>Open review case</Button>
        </form>
      ) : null}

      {mutationError ? (
        <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{mutationError.message}</p>
      ) : null}
      {notice ? <p role="status" className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <section className="min-w-0 rounded-xl border border-stone-300 bg-white p-5 shadow-sm" aria-labelledby="review-queue-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="review-queue-heading" className="text-xl font-bold text-stone-950">Queue</h2>
              <p className="mt-1 text-sm text-stone-600">SLA-overdue cases are surfaced first.</p>
            </div>
            {queue.data ? <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">{queue.data.total} cases</span> : null}
          </div>
          {!canRead ? <p className="mt-5 text-sm text-stone-600">Your capabilities do not include Review queue access.</p> : null}
          {queue.isPending && canRead ? <p className="mt-5 text-sm text-stone-600">Loading review queue…</p> : null}
          {queue.isError ? <p role="alert" className="mt-5 text-sm text-red-800">{queue.error.message}</p> : null}
          {queue.isSuccess ? (
            <>
              <div className="mt-5"><DataTable table={table} /></div>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-stone-700">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={page <= 1} onClick={() => void setPage(Math.max(1, page - 1))}>Previous</Button>
                  <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => void setPage(Math.min(totalPages, page + 1))}>Next</Button>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-labelledby="review-detail-heading">
            {surface.isPending && effectiveCaseId ? <p className="p-5 text-sm text-stone-600">Loading case detail…</p> : null}
            {surface.isError ? <p role="alert" className="p-5 text-sm text-red-800">{surface.error.message}</p> : null}
            {!effectiveCaseId && queue.isSuccess ? <p className="p-5 text-sm text-stone-600">Select a ReviewCase from the queue.</p> : null}
            {selected ? (
              <>
                <div className="border-b border-stone-200 bg-stone-950 p-5 text-white">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Selected case</p>
                      <h2 id="review-detail-heading" className="mt-2 text-2xl font-bold">{selected.reviewCase.reviewCaseId.slice(0, 8)}</h2>
                      <p className="mt-1 break-all font-mono text-xs text-stone-400">{selected.reviewCase.reviewCaseId}</p>
                    </div>
                    <span className="rounded-full border border-stone-600 px-3 py-1 text-xs font-semibold capitalize">{stateLabel(selected.reviewCase.state)}</span>
                  </div>
                </div>
                <div className="grid gap-3 border-b border-stone-200 p-5 sm:grid-cols-3">
                  <div><p className="text-xs font-semibold uppercase text-stone-500">Target panda</p><p className="mt-1 break-all text-sm font-semibold">{contribution?.targetPandaId ?? "—"}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-stone-500">Revision</p><p className="mt-1 text-sm font-semibold">{selected.reviewCase.revisionNumber}</p></div>
                  <div><p className="text-xs font-semibold uppercase text-stone-500">Assignee</p><p className="mt-1 break-all text-sm font-semibold">{selected.reviewCase.primaryAssigneeId?.slice(0, 8) ?? "Unassigned"}</p></div>
                </div>
                <div className="space-y-5 p-5">
                  <div>
                    <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-stone-950">Assertions</h3><span className="text-xs text-stone-500">{contribution?.assertions.length ?? 0}</span></div>
                    <ul className="mt-3 space-y-2">
                      {contribution?.assertions.map((assertion) => (
                        <li key={assertion.assertionKey} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                          <div className="flex items-start justify-between gap-3"><strong className="text-sm">{assertion.fieldKey}</strong><span className="text-xs font-semibold capitalize text-stone-500">{assertion.certainty}</span></div>
                          <p className="mt-1 break-words text-sm text-stone-700">{JSON.stringify(assertion.value)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-stone-950">Sources</h3><span className="text-xs text-stone-500">{contribution?.sources.length ?? 0}</span></div>
                    <ul className="mt-3 space-y-2">
                      {contribution?.sources.map((source) => (
                        <li key={source.sourceId} className="rounded-lg border border-stone-200 p-3">
                          <p className="text-sm font-semibold text-stone-950">{source.title}</p>
                          <p className="mt-1 break-all text-xs text-stone-600">{source.locator}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {canClaim ? (
                    <Button
                      type="button"
                      disabled={busy || selected.reviewCase.state === "closed" || selected.reviewCase.state === "incorporation_recommended"}
                      onClick={() => claimMutation.mutate(selected.reviewCase.reviewCaseId)}
                    >
                      Claim case
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
              <h2 className="text-lg font-bold text-stone-950">Verify source</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">Source
                  <select aria-label="Source" value={selectedSource?.sourceId ?? ""} onChange={(event) => setSourceId(event.target.value)} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    {contribution.sources.map((source) => <option key={source.sourceId} value={source.sourceId}>{source.title}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">Outcome
                  <select aria-label="Source outcome" value={sourceOutcome} onChange={(event) => setSourceOutcome(event.target.value as "verified" | "rejected")} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    <option value="verified">Verified</option><option value="rejected">Rejected</option>
                  </select>
                </label>
                {sourceOutcome === "verified" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-semibold">Normalized locator<input aria-label="Normalized locator" value={normalizedLocator} onChange={(event) => setNormalizedLocator(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-normal" /></label>
                    <label className="grid gap-1 text-sm font-semibold">Canonical source ID<input aria-label="Canonical source ID" value={canonicalSourceId} onChange={(event) => setCanonicalSourceId(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-xs font-normal" /></label>
                  </div>
                ) : null}
                <label className="grid gap-1 text-sm font-semibold">Reason<textarea aria-label="Source verification reason" value={sourceReason} onChange={(event) => setSourceReason(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !sourceReason.trim()}>Record verification</Button>
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
              <h2 className="text-lg font-bold text-stone-950">Decision</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">Outcome
                  <select aria-label="Decision outcome" value={decisionOutcome} onChange={(event) => setDecisionOutcome(event.target.value as typeof decisionOutcome)} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    <option value="accepted">Accepted</option><option value="not_accepted">Not accepted</option><option value="duplicate">Duplicate</option><option value="out_of_scope">Out of scope</option><option value="abuse">Abuse</option>
                  </select>
                </label>
                <fieldset>
                  <legend className="text-sm font-semibold">Selected assertions</legend>
                  <div className="mt-2 grid gap-2">
                    {contribution.assertions.map((assertion) => (
                      <label key={assertion.assertionKey} className="flex items-start gap-2 rounded-md border border-stone-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedAssertionKeys.includes(assertion.assertionKey)}
                          onChange={(event) => setSelectedAssertionKeys((current) => event.target.checked ? [...current, assertion.assertionKey] : current.filter((key) => key !== assertion.assertionKey))}
                        />
                        <span><strong>{assertion.fieldKey}</strong><span className="mt-1 block text-xs text-stone-600">{assertion.assertionKey}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {decisionOutcome === "duplicate" ? <label className="grid gap-1 text-sm font-semibold">Duplicate case ID<input aria-label="Duplicate case ID" value={duplicateOfReviewCaseId} onChange={(event) => setDuplicateOfReviewCaseId(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-xs font-normal" /></label> : null}
                <label className="grid gap-1 text-sm font-semibold">Contributor explanation<textarea aria-label="Contributor explanation" value={userVisibleExplanation} onChange={(event) => setUserVisibleExplanation(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Internal reason<textarea aria-label="Internal reason" value={internalReason} onChange={(event) => setInternalReason(event.target.value)} className="min-h-20 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !userVisibleExplanation.trim()}>Record decision</Button>
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
              <h2 className="text-lg font-bold text-stone-950">Curation handoff</h2>
              <p className="mt-1 text-sm text-stone-600">Only accepted assertions backed by verified canonical Evidence can be recommended.</p>
              <label className="mt-4 grid gap-1 text-sm font-semibold">Recommendation reason<textarea aria-label="Recommendation reason" value={recommendReason} onChange={(event) => setRecommendReason(event.target.value)} className="min-h-20 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
              <Button type="submit" className="mt-3" disabled={busy || !recommendReason.trim()}>Recommend to Curation</Button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
