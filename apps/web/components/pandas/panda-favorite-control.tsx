"use client";

import type { Route } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface PandaFavoriteControlProps {
  stableId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
}

type FavoriteState = "loading" | "signed-out" | "not-favorite" | "favorite";

interface FavoriteListResponse {
  items: Array<{ pandaId: string }>;
}

const copy = {
  zh: {
    add: (name: string) => `收藏${name}`,
    added: "已收藏",
    remove: (name: string) => `取消收藏${name}`,
    saved: (name: string) => `已把${name}加入“我的熊猫”。`,
    removed: (name: string) => `已取消收藏${name}。`,
    unavailable: "收藏暂时不可用，请稍后重试。",
    support: "收藏会同步到“我的熊猫”；通知偏好可以在通知中心单独设置。",
    collections: "整理我的合集",
  },
  en: {
    add: (name: string) => `Favorite ${name}`,
    added: "Favorited",
    remove: (name: string) => `Remove ${name} from favorites`,
    saved: (name: string) => `${name} is now in My Pandas.`,
    removed: (name: string) => `${name} was removed from your favorites.`,
    unavailable: "Favorites are temporarily unavailable. Please try again.",
    support: "Favorites sync to My Pandas; notification preferences are managed separately in the notification center.",
    collections: "Organize collections",
  },
} as const;

export function PandaFavoriteControl({
  stableId,
  slug,
  name,
  locale,
}: PandaFavoriteControlProps) {
  const engagementEnabled = isEngagementUiEnabled();
  const [state, setState] = useState<FavoriteState>("loading");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const t = copy[locale];
  const returnPath = `/${locale}/pandas/${slug}`;
  const collectionsPath = `/${locale}/me/collections` as Route;

  useEffect(() => {
    if (!engagementEnabled) return;
    let cancelled = false;

    async function loadState() {
      const session = await fetch("/api/identity/session", { cache: "no-store" });
      if (cancelled) return;
      if (session.status === 401) {
        setState("signed-out");
        return;
      }
      if (!session.ok) {
        setState("not-favorite");
        setFeedback(t.unavailable);
        return;
      }

      const favorites = await fetch("/api/engagement/favorites", { cache: "no-store" });
      if (cancelled) return;
      if (favorites.status === 401) {
        setState("signed-out");
        return;
      }
      if (!favorites.ok) {
        setState("not-favorite");
        setFeedback(t.unavailable);
        return;
      }

      const payload = (await favorites.json()) as FavoriteListResponse;
      setState(payload.items.some((favorite) => favorite.pandaId === stableId) ? "favorite" : "not-favorite");
    }

    void loadState();
    return () => {
      cancelled = true;
    };
  }, [engagementEnabled, stableId, t.unavailable]);

  function beginAuthentication() {
    window.location.assign(`/auth/login?next=${encodeURIComponent(returnPath)}`);
  }

  async function toggleFavorite() {
    if (state === "signed-out") {
      beginAuthentication();
      return;
    }

    const removing = state === "favorite";
    setBusy(true);
    setFeedback("");
    const response = await fetch(
      `/api/engagement/favorites/${encodeURIComponent(stableId)}`,
      { method: removing ? "DELETE" : "POST" },
    );
    setBusy(false);

    if (response.status === 401) {
      setState("signed-out");
      beginAuthentication();
      return;
    }
    if (!response.ok) {
      setFeedback(t.unavailable);
      return;
    }

    setState(removing ? "not-favorite" : "favorite");
    setFeedback(removing ? t.removed(name) : t.saved(name));
  }

  if (!engagementEnabled) return null;

  const favorited = state === "favorite";
  const label = favorited ? t.remove(name) : t.add(name);

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <button
        type="button"
        disabled={busy || state === "loading"}
        aria-busy={busy || state === "loading"}
        aria-pressed={favorited}
        aria-label={label}
        onClick={() => void toggleFavorite()}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-px disabled:cursor-wait disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 sm:w-auto"
      >
        <Heart className={`h-4 w-4 ${favorited ? "fill-current" : ""}`} aria-hidden="true" />
        {favorited ? t.added : t.add(name)}
      </button>
      <p className="text-sm leading-6 text-[var(--muted)]">{t.support}</p>
      {favorited ? (
        <Link
          className="min-h-12 self-start rounded-lg px-1 py-3 font-semibold underline underline-offset-4"
          href={collectionsPath}
        >
          {t.collections}
        </Link>
      ) : null}
      {feedback ? (
        <p
          className="rounded-lg border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] px-3 py-2 text-sm leading-6"
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
