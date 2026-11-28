"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

import { hasAppDownload, type AppDownloadLinks } from "@/lib/app-download";
import type { PublicLocale } from "@/lib/locales";

const DISMISSED_UNTIL_KEY = "zhipanda.open-in-app.dismissed-until";
const DISMISS_DAYS = 30;

type Target = { href: string; label: "get" | "beta" | "page" };

function chooseTarget(links: AppDownloadLinks, locale: PublicLocale, userAgent: string): Target | null {
  if (!hasAppDownload(links)) return null;
  const ios = /iPhone|iPad|iPod/u.test(userAgent);
  const android = /Android/u.test(userAgent);
  if (ios) {
    // Safari shows its own Smart App Banner when the store id is set; two bars would stack.
    if (links.iosStoreId && !/CriOS|FxiOS|EdgiOS/u.test(userAgent)) return null;
    if (links.ios) return { href: links.ios, label: "get" };
    return links.testflight ? { href: links.testflight, label: "beta" } : null;
  }
  if (android) return links.android ? { href: links.android, label: "get" } : null;
  return { href: `/${locale}/app`, label: "page" };
}

function subscribeToNothing(): () => void {
  return () => {};
}

function dismissedNow(): boolean {
  try {
    return Number(window.localStorage.getItem(DISMISSED_UNTIL_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

const labels = {
  zh: { title: "吱熊猫 App", get: "获取", beta: "参加测试", page: "下载 App", close: "关闭" },
  en: { title: "ZhiPanda app", get: "Get", beta: "Join beta", page: "Get the app", close: "Close" },
} as const;

export function OpenInAppBar({ locale, links, message }: { locale: PublicLocale; links: AppDownloadLinks; message: string }) {
  // The server render has no user agent or storage, so the bar appears only after hydration.
  const userAgent = useSyncExternalStore(
    subscribeToNothing,
    () => (dismissedNow() ? null : window.navigator.userAgent),
    () => null,
  );
  const [closed, setClosed] = useState(false);
  const target = !closed && userAgent ? chooseTarget(links, locale, userAgent) : null;

  if (!target) return null;
  const copy = labels[locale];

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      // Private mode can refuse storage; the bar still closes for this page view.
    }
    setClosed(true);
  }

  const linkClass = "ml-auto inline-flex min-h-11 shrink-0 items-center rounded-full bg-[var(--pa-color-accent)] px-4 text-sm font-bold text-[var(--pa-color-on-accent)] hover:bg-[var(--pa-color-accent-hover)]";
  return (
    <aside
      aria-label={copy.title}
      data-testid="open-in-app-bar"
      data-open-in-app-bar=""
      className="fixed inset-x-0 bottom-0 z-40 border-t-[0.5px] border-[var(--pa-color-line)] bg-[var(--pa-color-surface)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="pa-shell flex items-center gap-3 py-2.5">
        <p className="grid min-w-0 leading-snug">
          <strong className="text-sm">{copy.title}</strong>
          <span className="truncate text-xs text-[var(--pa-color-ink-muted)]">{message}</span>
        </p>
        {target.label === "page" ? (
          <Link href={target.href as Route} className={linkClass}>{copy.page}</Link>
        ) : (
          <a href={target.href} className={linkClass}>{copy[target.label]}</a>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={copy.close}
          className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center text-[var(--pa-color-ink-muted)] hover:text-[var(--pa-color-ink)]"
        >
          <X aria-hidden="true" size={18} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
