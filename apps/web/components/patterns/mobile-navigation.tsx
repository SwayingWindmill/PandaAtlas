"use client";

import type { Route } from "next";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PublicLocale } from "@/foundation/content/locales";

interface MobileNavigationProps {
  locale: PublicLocale;
  languageHref: string;
  languageHrefLang: "zh-CN" | "en";
  labels: {
    open: string;
    close: string;
    navigation: string;
    home: string;
    atlas: string;
    lineage: string;
    language: string;
  };
}

export function MobileNavigation({
  locale,
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
          <Link href={`/${locale}/atlas`} onClick={() => setOpen(false)}>{labels.atlas}</Link>
          <Link href={`/${locale}/lineage` as Route} onClick={() => setOpen(false)}>{labels.lineage}</Link>
          <Link href={languageHref as Route} hrefLang={languageHrefLang} onClick={() => setOpen(false)}>
            {labels.language}
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
