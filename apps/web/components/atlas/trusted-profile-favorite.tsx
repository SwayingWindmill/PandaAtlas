"use client";

import { Heart } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import {
  readProfilePreferences,
  subscribeToProfilePreferences,
  toggleSavedProfile,
} from "@/features/preferences/profile-preferences";

function subscribeToHydration(): () => void {
  return () => undefined;
}

interface TrustedProfileFavoriteProps {
  stableId: string;
  slug: string;
  name: string;
  locale: "zh" | "en";
}

export function TrustedProfileFavorite({ stableId, slug, name, locale }: TrustedProfileFavoriteProps) {
  const references = useMemo(() => [{ id: stableId, aliases: [slug] }], [slug, stableId]);
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const saved = useSyncExternalStore(
    subscribeToProfilePreferences,
    () => readProfilePreferences(references).saved.some((entry) => entry.id === stableId),
    () => false,
  );

  function toggleFavorite() {
    toggleSavedProfile(stableId, references);
  }

  const label = locale === "zh"
    ? `${saved ? "取消收藏" : "收藏"}${name}`
    : `${saved ? "Remove" : "Save"} ${name}`;

  return (
    <div className="flex max-w-sm flex-col gap-2">
      <button
        type="button"
        disabled={!ready}
        aria-busy={!ready}
        aria-pressed={saved}
        aria-label={label}
        onClick={toggleFavorite}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-px disabled:cursor-wait disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
      >
        <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
        {locale === "zh" ? (saved ? "已收藏" : "收藏档案") : (saved ? "Saved" : "Save profile")}
      </button>
      <p className="text-xs leading-5 text-[var(--muted)]">
        {locale === "zh"
          ? "收藏仅保存在此浏览器。更换设备或清除浏览器数据后可能丢失。"
          : "Saved only in this browser. It may be lost when you change devices or clear browser data."}
      </p>
    </div>
  );
}
