"use client";

import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "panda-atlas:saved-profiles";
const FAVORITES_CHANGE_EVENT = "panda-atlas:favorites-change";

function readFavorites(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function subscribeToFavorites(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(FAVORITES_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(FAVORITES_CHANGE_EVENT, onStoreChange);
  };
}

function subscribeToHydration(): () => void {
  return () => undefined;
}

interface TrustedProfileFavoriteProps {
  slug: string;
  name: string;
  locale: "zh" | "en";
}

export function TrustedProfileFavorite({ slug, name, locale }: TrustedProfileFavoriteProps) {
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const saved = useSyncExternalStore(
    subscribeToFavorites,
    () => readFavorites().includes(slug),
    () => false,
  );

  function toggleFavorite() {
    const favorites = new Set(readFavorites());
    if (favorites.has(slug)) {
      favorites.delete(slug);
    } else {
      favorites.add(slug);
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    window.dispatchEvent(new Event(FAVORITES_CHANGE_EVENT));
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
