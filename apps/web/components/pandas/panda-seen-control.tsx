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
    added: "已见过",
    remove: (name: string) => `删除见过${name}的记录`,
    saved: (name: string) => `已记录你见过${name}。`,
    removed: (name: string) => `已删除你见过${name}的记录。`,
    unavailable: "“见过熊猫”暂时不可用，请稍后重试。",
  },
  en: {
    add: (name: string) => `I've seen ${name}`,
    added: "Seen",
    remove: (name: string) => `Remove my seen record for ${name}`,
    saved: (name: string) => `Recorded that you've seen ${name}.`,
    removed: (name: string) => `Removed your seen record for ${name}.`,
    unavailable: "Seen-panda records are temporarily unavailable. Please try again.",
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
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy || loading}
        aria-busy={busy || loading}
        aria-pressed={seen}
        aria-label={seen ? t.remove(name) : t.add(name)}
        onClick={toggleSeen}
        className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-full bg-[var(--pa-color-surface-subtle)] px-6 text-base font-semibold text-[var(--pa-color-ink)] transition-colors duration-250 ease-out hover:bg-[var(--pa-color-surface-hover)] disabled:cursor-wait disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pa-color-highlight)] focus-visible:ring-offset-2"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        {seen ? t.added : t.add(name)}
      </button>
      {message ? <p className="text-xs leading-5 text-[var(--pa-color-ink-muted)]" role="status">{message}</p> : null}
    </div>
  );
}
