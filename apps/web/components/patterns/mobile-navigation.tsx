"use client";

import type { Route } from "next";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicLocale } from "@/foundation/content/locales";

interface MobileNavigationProps {
  locale: PublicLocale;
  contributeEnabled: boolean;
  feedEnabled: boolean;
  notificationCenterEnabled: boolean;
  languageHref: string;
  languageHrefLang: "zh-CN" | "en";
  labels: {
    open: string;
    close: string;
    navigation: string;
    home: string;
    atlas: string;
    moments: string;
    families: string;
    lineage: string;
    map: string;
    myPandas: string;
    contribute: string;
    feed: string;
    inbox: string;
    language: string;
  };
}

export function MobileNavigation({
  locale,
  contributeEnabled,
  feedEnabled,
  notificationCenterEnabled,
  languageHref,
  languageHrefLang,
  labels,
}: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        toggleButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="pa-mobile-nav lg:hidden">
      <button
        type="button"
        className="pa-icon-button"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        aria-controls="public-mobile-navigation"
        onClick={() => setOpen((value) => !value)}
        ref={toggleButtonRef}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      {open ? (
        <nav id="public-mobile-navigation" aria-label={labels.navigation} className="pa-mobile-nav-panel">
          <Link href={`/${locale}`} onClick={() => setOpen(false)}>{labels.home}</Link>
          <Link href={`/${locale}/pandas`} onClick={() => setOpen(false)}>{labels.atlas}</Link>
          <Link href={`/${locale}/moments` as Route} onClick={() => setOpen(false)}>{labels.moments}</Link>
          <Link href={`/${locale}/families/smithsonian-generations` as Route} onClick={() => setOpen(false)}>{labels.families}</Link>
          <Link href={`/${locale}/lineage` as Route} onClick={() => setOpen(false)}>{labels.lineage}</Link>
          <Link href={`/${locale}/map` as Route} onClick={() => setOpen(false)}>{labels.map}</Link>
          {contributeEnabled ? (
            <Link href={`/${locale}/contribute` as Route} onClick={() => setOpen(false)}>
              {labels.contribute}
            </Link>
          ) : null}
          {feedEnabled ? (
            <Link href={`/${locale}/me/feed` as Route} onClick={() => setOpen(false)}>
              {labels.feed}
            </Link>
          ) : null}
          {notificationCenterEnabled ? (
            <Link href={`/${locale}/me/inbox` as Route} onClick={() => setOpen(false)}>
              {labels.inbox}
            </Link>
          ) : null}
          <Link href={`/${locale}/me/passport` as Route} onClick={() => setOpen(false)}>{labels.myPandas}</Link>
          <Link href={languageHref as Route} hrefLang={languageHrefLang} onClick={() => setOpen(false)}>
            {labels.language}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
