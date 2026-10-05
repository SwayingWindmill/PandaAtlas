"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table/data-table";
import { adminSessionQueryOptions } from "@/features/admin/session/api/queries";
import {
  moderationAccountQueryOptions,
  moderationAppealsQueryOptions,
  moderationKeys,
  moderationMutationOptions,
} from "../api/queries";
import type {
  AppealState,
  ModerationAppealQueueItem,
  ModerationSanction,
} from "../api/types";

const PAGE_SIZE = 25;
const appealStates: readonly AppealState[] = ["open", "under_review", "closed"];
const appealColumnHelper = createColumnHelper<ModerationAppealQueueItem>();

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatAge(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

function hasCapability(capabilities: readonly string[] | undefined, capability: string): boolean {
  return capabilities?.includes(capability) ?? false;
}

function stateLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function projectionState(active: boolean): { label: string; className: string } {
  return active
    ? { label: "Restricted", className: "border-red-200 bg-red-50 text-red-900" }
    : { label: "Clear", className: "border-emerald-200 bg-emerald-50 text-emerald-900" };
}

export function ModerationWorkspace() {
  const queryClient = useQueryClient();
  const session = useQuery(adminSessionQueryOptions);
  const capabilities = session.data?.capabilities;
  const canRead = hasCapability(capabilities, "moderation.sanction.read");
  const canApply = hasCapability(capabilities, "moderation.sanction.apply");
  const canRestore = hasCapability(capabilities, "moderation.sanction.restore");
  const canDecideAppeal = hasCapability(capabilities, "moderation.appeal.decide");

  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: true }));
  const [state, setState] = useQueryState("state", { shallow: true });
  const [selectedAppealId, setSelectedAppealId] = useQueryState("appeal", { shallow: true });
  const [accountId, setAccountId] = useQueryState("account", { shallow: true });
  const normalizedState = appealStates.includes(state as AppealState) ? state as AppealState : "open";
  const appealsQuery = { limit: PAGE_SIZE, offset: Math.max(0, page - 1) * PAGE_SIZE, state: normalizedState };
  const appeals = useQuery({ ...moderationAppealsQueryOptions(appealsQuery), enabled: canDecideAppeal });
  const effectiveAppealId = selectedAppealId ?? appeals.data?.items[0]?.appealCaseId;
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
      setNotice(`Applied ${stateLabel(sanction.kind)} sanction.`);
      await refreshAccount(sanction.accountId);
    },
  });
  const restoreMutation = useMutation({
    ...moderationMutationOptions.restoreSanction(),
    onSuccess: async () => {
      setRestoreInternal("");
      setRestoreVisible("");
      setNotice("Sanction restored.");
      await refreshAccount(effectiveAccountId);
    },
  });
  const decideAppealMutation = useMutation({
    ...moderationMutationOptions.decideAppeal(),
    onSuccess: async () => {
      setAppealInternal("");
      setAppealVisible("");
      setNotice("Appeal decision recorded.");
      await queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    },
  });

  const selectAppeal = useCallback(async (appeal: ModerationAppealQueueItem) => {
    await Promise.all([
      setSelectedAppealId(appeal.appealCaseId),
      setAccountId(appeal.accountId),
    ]);
    setNotice(null);
  }, [setAccountId, setSelectedAppealId]);

  const columns = useMemo(() => [
    appealColumnHelper.accessor("appealCaseId", {
      header: "Appeal",
      cell: ({ row }) => (
        <button
          type="button"
          className="text-left font-semibold text-stone-950 underline decoration-stone-400 underline-offset-4"
          onClick={() => void selectAppeal(row.original)}
        >
          {row.original.appealCaseId.slice(0, 8)}
        </button>
      ),
    }),
    appealColumnHelper.accessor("state", {
      header: "State",
      cell: ({ getValue }) => <span className="capitalize">{stateLabel(getValue())}</span>,
    }),
    appealColumnHelper.accessor("accountId", {
      header: "Account",
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue().slice(0, 8)}</span>,
    }),
    appealColumnHelper.accessor("ageSeconds", { header: "Age", cell: ({ getValue }) => formatAge(getValue()) }),
    appealColumnHelper.accessor("slaOverdue", {
      header: "SLA",
      cell: ({ getValue }) => getValue()
        ? <span className="font-semibold text-red-700">Overdue</span>
        : <span className="text-stone-600">On track</span>,
    }),
  ], [selectAppeal]);
  // TanStack Table intentionally exposes non-memoizable helpers; React Compiler skips this hook safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: appeals.data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  const totalPages = Math.max(1, Math.ceil((appeals.data?.total ?? 0) / PAGE_SIZE));
  const subject = account.data?.subject;
  const sanctions = account.data?.sanctions ?? [];
  const mutationError = applyMutation.error ?? restoreMutation.error ?? decideAppealMutation.error;
  const busy = applyMutation.isPending || restoreMutation.isPending || decideAppealMutation.isPending;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-600">Moderation</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-950">Account moderation &amp; appeals</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-700">
            Inspect the current moderation projection, apply scoped sanctions, restore current sanctions, and decide member appeals through V2.
          </p>
        </div>
        {canDecideAppeal ? (
          <label className="text-sm font-semibold text-stone-700">
            Appeal state
            <select
              aria-label="Appeal state"
              value={normalizedState}
              onChange={(event) => {
                void setState(event.target.value === "open" ? null : event.target.value);
                void setPage(1);
              }}
              className="ml-2 min-h-10 rounded-md border border-stone-400 bg-white px-3 capitalize"
            >
              {appealStates.map((value) => <option key={value} value={value}>{stateLabel(value)}</option>)}
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
              void setAccountId(lookupAccountId.trim());
              setNotice(null);
            }
          }}
        >
          <label className="grid min-w-72 flex-1 gap-1 text-sm font-semibold text-stone-800">
            Inspect account
            <input
              aria-label="Account ID"
              value={lookupAccountId}
              onChange={(event) => setLookupAccountId(event.target.value)}
              placeholder="Account UUID"
              className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-sm font-normal"
            />
          </label>
          <Button type="submit" disabled={!lookupAccountId.trim()}>Load account</Button>
        </form>
      ) : null}

      {mutationError ? <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">{mutationError.message}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</p> : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="min-w-0 rounded-xl border border-stone-300 bg-white p-5 shadow-sm" aria-labelledby="appeal-queue-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="appeal-queue-heading" className="text-xl font-bold text-stone-950">Appeal queue</h2>
              <p className="mt-1 text-sm text-stone-600">Open member appeals ordered by SLA urgency.</p>
            </div>
            {appeals.data ? <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">{appeals.data.total} appeals</span> : null}
          </div>
          {!canDecideAppeal ? <p className="mt-5 text-sm text-stone-600">Your capabilities do not include appeal decisions.</p> : null}
          {appeals.isPending && canDecideAppeal ? <p className="mt-5 text-sm text-stone-600">Loading appeals…</p> : null}
          {appeals.isError ? <p role="alert" className="mt-5 text-sm text-red-800">{appeals.error.message}</p> : null}
          {appeals.isSuccess ? (
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
          <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-labelledby="account-state-heading">
            {account.isPending && effectiveAccountId ? <p className="p-5 text-sm text-stone-600">Loading moderation account…</p> : null}
            {account.isError ? <p role="alert" className="p-5 text-sm text-red-800">{account.error.message}</p> : null}
            {!effectiveAccountId ? <p className="p-5 text-sm text-stone-600">Select an appeal or load an account ID.</p> : null}
            {subject ? (
              <>
                <div className="border-b border-stone-200 bg-stone-950 p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Account projection</p>
                  <h2 id="account-state-heading" className="mt-2 text-2xl font-bold">{subject.accountId.slice(0, 8)}</h2>
                  <p className="mt-1 break-all font-mono text-xs text-stone-400">{subject.accountId}</p>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {[
                    ["Submission", subject.submissionRestricted],
                    ["Attachment", subject.attachmentRestricted],
                    ["Notification", subject.notificationRestricted],
                    ["Account", subject.accountSuspended || subject.accountClosedForAbuse],
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
                    <h3 className="font-bold text-stone-950">Sanction history</h3>
                    <span className="text-xs text-stone-500">Repeat abuse {subject.repeatAbuseCount}</span>
                  </div>
                  {sanctions.length ? (
                    <ul className="mt-3 space-y-2">
                      {sanctions.map((sanction) => (
                        <li key={sanction.sanctionId} className="rounded-lg border border-stone-200 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold capitalize">{stateLabel(sanction.kind)}</p>
                              <p className="mt-1 text-xs text-stone-600">{sanction.reasonCode} · {formatDate(sanction.startsAt)}</p>
                              {sanction.endsAt ? <p className="mt-1 text-xs text-stone-500">Ends {formatDate(sanction.endsAt)}</p> : null}
                            </div>
                            {canRestore ? <Button type="button" size="sm" variant="outline" onClick={() => setRestoreSanctionId(sanction.sanctionId)}>Restore</Button> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-stone-600">No sanctions recorded for this account.</p>}
                </div>
              </>
            ) : null}
          </section>

          {selectedAppeal ? (
            <section className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Selected appeal</p>
                  <h2 className="mt-1 text-lg font-bold text-stone-950">{selectedAppeal.appealCaseId.slice(0, 8)}</h2>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${selectedAppeal.slaOverdue ? "bg-red-100 text-red-900" : "bg-stone-100 text-stone-700"}`}>
                  {selectedAppeal.slaOverdue ? "SLA overdue" : stateLabel(selectedAppeal.state)}
                </span>
              </div>
              <blockquote className="mt-4 rounded-lg border-l-4 border-stone-400 bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                {selectedAppeal.userStatement}
              </blockquote>
              <p className="mt-3 text-xs text-stone-500">Sanction {selectedAppeal.sanctionId.slice(0, 8)} · Due {formatDate(selectedAppeal.firstResponseDueAt)}</p>
            </section>
          ) : null}

          {subject && canApply ? (
            <form
              className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (!effectiveAccountId || !sanctionInternal.trim() || !sanctionVisible.trim()) return;
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
            >
              <h2 className="text-lg font-bold text-stone-950">Apply sanction</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">Kind
                  <select aria-label="Sanction kind" value={sanctionKind} onChange={(event) => setSanctionKind(event.target.value as ModerationSanction["kind"])} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    <option value="warning">Warning</option><option value="submission_restricted">Submission restricted</option><option value="attachment_restricted">Attachment restricted</option><option value="notification_restricted">Notification restricted</option><option value="account_suspended">Account suspended</option><option value="account_closed_for_abuse">Account closed for abuse</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">Reason code<input aria-label="Sanction reason code" value={sanctionReasonCode} onChange={(event) => setSanctionReasonCode(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-sm font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Ends at <span className="font-normal text-stone-500">(optional)</span><input aria-label="Sanction ends at" type="datetime-local" value={sanctionEndsAt} onChange={(event) => setSanctionEndsAt(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Internal explanation<textarea aria-label="Sanction internal explanation" value={sanctionInternal} onChange={(event) => setSanctionInternal(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Member explanation<textarea aria-label="Sanction member explanation" value={sanctionVisible} onChange={(event) => setSanctionVisible(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !sanctionReasonCode.trim() || !sanctionInternal.trim() || !sanctionVisible.trim()}>Apply sanction</Button>
              </div>
            </form>
          ) : null}

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
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-stone-950">Restore sanction</h2><p className="mt-1 font-mono text-xs text-stone-500">{restoreSanctionId}</p></div><Button type="button" variant="outline" size="sm" onClick={() => setRestoreSanctionId("")}>Cancel</Button></div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">Reason code<input aria-label="Restore reason code" value={restoreReasonCode} onChange={(event) => setRestoreReasonCode(event.target.value)} className="min-h-10 rounded-md border border-stone-400 px-3 font-mono text-sm font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Internal explanation<textarea aria-label="Restore internal explanation" value={restoreInternal} onChange={(event) => setRestoreInternal(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Member explanation<textarea aria-label="Restore member explanation" value={restoreVisible} onChange={(event) => setRestoreVisible(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !restoreReasonCode.trim() || !restoreInternal.trim() || !restoreVisible.trim()}>Restore sanction</Button>
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
              <h2 className="text-lg font-bold text-stone-950">Decide appeal</h2>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">Outcome
                  <select aria-label="Appeal outcome" value={appealOutcome} onChange={(event) => setAppealOutcome(event.target.value as typeof appealOutcome)} className="min-h-10 rounded-md border border-stone-400 bg-white px-3 font-normal">
                    <option value="upheld">Upheld</option><option value="modified">Modified</option><option value="overturned">Overturned</option><option value="dismissed">Dismissed</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold">Internal explanation<textarea aria-label="Appeal internal explanation" value={appealInternal} onChange={(event) => setAppealInternal(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Member explanation<textarea aria-label="Appeal member explanation" value={appealVisible} onChange={(event) => setAppealVisible(event.target.value)} className="min-h-24 rounded-md border border-stone-400 px-3 py-2 font-normal" /></label>
                <Button type="submit" disabled={busy || !appealInternal.trim() || !appealVisible.trim()}>Record appeal decision</Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
