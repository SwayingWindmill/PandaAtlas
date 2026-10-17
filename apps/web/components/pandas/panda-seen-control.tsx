"use client";

import { Eye } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { fanMutationOptions, seenPandaQueryOptions } from "@/features/fan/api/queries";
import { beginSignIn, privateReadStatus, redirectedToSignIn, useFanSession } from "@/features/fan/api/session";
import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface PandaSeenControlProps {
  stableId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
}

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const copy = {
  zh: {
    add: (name: string) => `我见过${name}`,
    added: "我见过 TA",
    remove: (name: string) => `删除见过${name}的记录`,
    saved: (name: string) => `已记录你见过${name}。`,
    removed: (name: string) => `已删除你见过${name}的记录。`,
    unavailable: "“见过熊猫”暂时不可用，请稍后重试。",
    support: "这是你的私人见面记录；不会因为去过某个地点自动添加。",
  },
  en: {
    add: (name: string) => `I've seen ${name}`,
    added: "I've seen this panda",
    remove: (name: string) => `Remove my seen record for ${name}`,
    saved: (name: string) => `Recorded that you've seen ${name}.`,
    removed: (name: string) => `Removed your seen record for ${name}.`,
    unavailable: "Seen-panda records are temporarily unavailable. Please try again.",
    support: "This is your private panda memory. Visiting a place never adds it automatically.",
  },
} as const;

export function PandaSeenControl({ stableId, slug, name, locale }: PandaSeenControlProps) {
  const engagementEnabled = isEngagementUiEnabled();
  const session = useFanSession(engagementEnabled);
  const seenPanda = useQuery({ ...seenPandaQueryOptions(stableId), enabled: engagementEnabled && session.status === "ready" });
  const [feedback, setFeedback] = useState("");
  const t = copy[locale];
  const returnPath = `/${locale}/pandas/${slug}`;

  const save = useMutation(fanMutationOptions.saveSeenPanda());
  const remove = useMutation(fanMutationOptions.removeSeenPanda());
  const status = privateReadStatus(session.status, seenPanda);
  const failed = (error: Error) => {
    if (!redirectedToSignIn(error, returnPath)) setFeedback(t.unavailable);
  };

  if (!engagementEnabled) return null;

  const seen = seenPanda.data !== null && seenPanda.data !== undefined;
  const loading = status === "loading";
  const unavailable = status === "blocked" || status === "unavailable";
  const busy = save.isPending || remove.isPending;
  const message = feedback || (unavailable ? t.unavailable : "");

  function toggleSeen() {
    if (status === "signed-out") {
      beginSignIn(returnPath);
      return;
    }
    setFeedback("");
    if (seen) remove.mutate(stableId, { onSuccess: () => setFeedback(t.removed(name)), onError: failed });
    else save.mutate(
      { pandaId: stableId, record: { seenOn: localDate(), placeId: null, note: null } },
      { onSuccess: () => setFeedback(t.saved(name)), onError: failed },
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <button
        type="button"
        disabled={busy || loading}
        aria-busy={busy || loading}
        aria-pressed={seen}
        aria-label={seen ? t.remove(name) : t.add(name)}
        onClick={toggleSeen}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--pa-color-accent-border-14)] bg-[var(--card)] px-5 py-3 text-base font-semibold text-[var(--accent)] transition-transform hover:-translate-y-0.5 active:translate-y-px disabled:cursor-wait disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 sm:w-auto"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        {seen ? t.added : t.add(name)}
      </button>
      <p className="text-sm leading-6 text-[var(--muted)]">{t.support}</p>
      {message ? <p className="text-sm leading-6" role="status">{message}</p> : null}
    </div>
  );
}
