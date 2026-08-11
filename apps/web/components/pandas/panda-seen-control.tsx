"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";

import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface PandaSeenControlProps {
  stableId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
}

type SeenState = "loading" | "signed-out" | "not-seen" | "seen";

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
  const [state, setState] = useState<SeenState>("loading");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const t = copy[locale];
  const returnPath = `/${locale}/pandas/${slug}`;

  useEffect(() => {
    if (!engagementEnabled) return;
    let active = true;

    async function loadState() {
      const session = await fetch("/api/identity/session", { cache: "no-store" });
      if (!active) return;
      if (session.status === 401) {
        setState("signed-out");
        return;
      }
      if (!session.ok) {
        setState("not-seen");
        setFeedback(t.unavailable);
        return;
      }
      const response = await fetch(`/api/engagement/seen-pandas/${encodeURIComponent(stableId)}`, {
        cache: "no-store",
      });
      if (!active) return;
      if (response.ok) setState("seen");
      else if (response.status === 404) setState("not-seen");
      else if (response.status === 401) setState("signed-out");
      else {
        setState("not-seen");
        setFeedback(t.unavailable);
      }
    }

    void loadState();
    return () => {
      active = false;
    };
  }, [engagementEnabled, stableId, t.unavailable]);

  async function toggleSeen() {
    if (state === "signed-out") {
      window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    const removing = state === "seen";
    setBusy(true);
    setFeedback("");
    const response = await fetch(`/api/engagement/seen-pandas/${encodeURIComponent(stableId)}`, {
      method: removing ? "DELETE" : "PUT",
      ...(removing
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seen_on: localDate(), place_id: null, note: null }),
          }),
    });
    setBusy(false);
    if (response.status === 401) {
      setState("signed-out");
      window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (!response.ok) {
      setFeedback(t.unavailable);
      return;
    }
    setState(removing ? "not-seen" : "seen");
    setFeedback(removing ? t.removed(name) : t.saved(name));
  }

  if (!engagementEnabled) return null;
  const seen = state === "seen";

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <button
        type="button"
        disabled={busy || state === "loading"}
        aria-busy={busy || state === "loading"}
        aria-pressed={seen}
        aria-label={seen ? t.remove(name) : t.add(name)}
        onClick={() => void toggleSeen()}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--pa-color-accent-border-14)] bg-[var(--card)] px-5 py-3 text-base font-semibold text-[var(--accent)] transition-transform hover:-translate-y-0.5 active:translate-y-px disabled:cursor-wait disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 sm:w-auto"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        {seen ? t.added : t.add(name)}
      </button>
      <p className="text-sm leading-6 text-[var(--muted)]">{t.support}</p>
      {feedback ? <p className="text-sm leading-6" role="status">{feedback}</p> : null}
    </div>
  );
}
