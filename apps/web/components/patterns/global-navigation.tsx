import type { Route } from "next";
import Link from "next/link";
import { Leaf, ShieldCheck } from "lucide-react";
import type { PublicLocale } from "@/foundation/content/locales";
import { alternateLocale } from "@/foundation/content/locales";
import { MobileNavigation } from "@/components/patterns/mobile-navigation";

interface GlobalNavigationProps {
  locale: PublicLocale;
  active: "home" | "atlas" | "profile" | "lineage" | "map";
  alternatePath?: string;
}

const copy = {
  zh: {
    brand: "PandaAtlas",
    description: "可信的大熊猫公开档案",
    home: "首页",
    atlas: "熊猫档案",
    lineage: "谱系",
    map: "地图",
    trust: "来源优先",
    nav: "主导航",
    mobileNav: "移动导航",
    open: "打开导航菜单",
    close: "关闭导航菜单",
    language: "English",
  },
  en: {
    brand: "PandaAtlas",
    description: "Trusted public giant panda archive",
    home: "Home",
    atlas: "Panda profiles",
    lineage: "Lineage",
    map: "Map",
    trust: "Evidence first",
    nav: "Primary navigation",
    mobileNav: "Mobile navigation",
    open: "Open navigation menu",
    close: "Close navigation menu",
    language: "中文",
  },
} as const;

export const publicShellClassName = "pa-shell";

export function GlobalNavigation({ locale, active, alternatePath }: GlobalNavigationProps) {
  const t = copy[locale];
  const otherLocale = alternateLocale(locale);
  const languageHref = alternatePath ?? `/${otherLocale}`;
  const languageHrefLang = otherLocale === "zh" ? "zh-CN" : "en";

  return (
    <>
      <a href="#main-content" className="pa-skip-link">
        {locale === "zh" ? "跳到主要内容" : "Skip to main content"}
      </a>
      <header className="pa-global-header">
        <div className={`${publicShellClassName} pa-global-header-inner`}>
          <Link href={`/${locale}` as Route} className="pa-brand" aria-label={`${t.brand} — ${t.description}`}>
            <span className="pa-brand-mark" aria-hidden="true"><Leaf /></span>
            <span>
              <strong>{t.brand}</strong>
              <small>{t.description}</small>
            </span>
          </Link>

          <nav className="pa-desktop-nav" aria-label={t.nav}>
            <Link href={`/${locale}` as Route} aria-current={active === "home" ? "page" : undefined}>{t.home}</Link>
            <Link href={`/${locale}/atlas` as Route} aria-current={active === "atlas" || active === "profile" ? "page" : undefined}>{t.atlas}</Link>
            <Link href={`/${locale}/lineage` as Route} aria-current={active === "lineage" ? "page" : undefined}>{t.lineage}</Link>
            <Link href={`/${locale}/map` as Route} aria-current={active === "map" ? "page" : undefined}>{t.map}</Link>
          </nav>

          <div className="pa-header-actions">
            <span className="pa-trust-mark"><ShieldCheck aria-hidden="true" />{t.trust}</span>
            <Link href={languageHref as Route} hrefLang={languageHrefLang} className="pa-language-link">
              {t.language}
            </Link>
            <MobileNavigation
              locale={locale}
              languageHref={languageHref}
              languageHrefLang={languageHrefLang}
              labels={{
                open: t.open,
                close: t.close,
                navigation: t.mobileNav,
                home: t.home,
                atlas: t.atlas,
                lineage: t.lineage,
                map: t.map,
                language: t.language,
              }}
            />
          </div>
        </div>
      </header>
    </>
  );
}
