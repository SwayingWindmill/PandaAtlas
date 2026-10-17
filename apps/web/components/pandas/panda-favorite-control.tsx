"use client";

import type { Route } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { fanMutationOptions, favoritesQueryOptions } from "@/features/fan/api/queries";
import { beginSignIn, privateReadStatus, redirectedToSignIn, useFanSession } from "@/features/fan/api/session";
import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface PandaFavoriteControlProps {
  stableId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
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
  const session = useFanSession(engagementEnabled);
  const favorites = useQuery({ ...favoritesQueryOptions, enabled: engagementEnabled && session.status === "ready" });
  const [feedback, setFeedback] = useState("");
  const t = copy[locale];
  const returnPath = `/${locale}/pandas/${slug}`;
  const collectionsPath = `/${locale}/me/collections` as Route;

  const toggle = useMutation(fanMutationOptions.setFavorite());
  const status = privateReadStatus(session.status, favorites);

  if (!engagementEnabled) return null;

  const favorited = favorites.data?.some((favorite) => favorite.pandaId === stableId) ?? false;
  const loading = status === "loading";
  const unavailable = status === "blocked" || status === "unavailable";
  const busy = toggle.isPending;
  const label = favorited ? t.remove(name) : t.add(name);
  const message = feedback || (unavailable ? t.unavailable : "");

  function toggleFavorite() {
    if (status === "signed-out") {
      beginSignIn(returnPath);
      return;
    }
    setFeedback("");
    toggle.mutate({ pandaId: stableId, favorite: !favorited }, {
      onSuccess: (_result, { favorite }) => setFeedback(favorite ? t.saved(name) : t.removed(name)),
      onError: (error) => {
        if (!redirectedToSignIn(error, returnPath)) setFeedback(t.unavailable);
      },
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <button
        type="button"
        disabled={busy || loading}
        aria-busy={busy || loading}
        aria-pressed={favorited}
        aria-label={label}
        onClick={toggleFavorite}
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
      {message ? (
        <p
          className="rounded-lg border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] px-3 py-2 text-sm leading-6"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
