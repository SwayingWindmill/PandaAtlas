import type { Route } from "next";
import Link from "next/link";
import type { PublicLocale } from "@/foundation/content/locales";
import { alternateLocale } from "@/foundation/content/locales";
import { MobileNavigation } from "@/components/patterns/mobile-navigation";
import { isCommunityIntakeUiEnabled } from "@/features/contribute/config";
import { isFeedUiEnabled } from "@/features/feed/config";

interface GlobalNavigationProps {
  locale: PublicLocale;
  active:
    | "home"
    | "atlas"
    | "profile"
    | "lineage"
    | "map"
    | "my-pandas"
    | "feed"
    | "contribute";
  alternatePath?: string;
}

const copy = {
  zh: {
    brand: "吱熊猫",
    description: "熊猫信息与探索",
    home: "首页",
    atlas: "熊猫",
    lineage: "谱系",
    map: "地图",
    myPandas: "我的熊猫",
    feed: "关注动态",
    contribute: "贡献",
    nav: "主导航",
    mobileNav: "移动导航",
    open: "打开导航菜单",
    close: "关闭导航菜单",
    language: "English",
  },
  en: {
    brand: "ZhiPanda",
    description: "Panda information and discovery",
    home: "Home",
    atlas: "Pandas",
    lineage: "Lineage",
    map: "Map",
    myPandas: "My Pandas",
    feed: "Follow Activity",
    contribute: "Contribute",
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
  const feedEnabled = isFeedUiEnabled();
  const contributeEnabled = isCommunityIntakeUiEnabled();

  return (
    <>
      <a href="#main-content" className="pa-skip-link">
        {locale === "zh" ? "跳到主要内容" : "Skip to main content"}
      </a>
      <header className="pa-global-header">
        <div className={`${publicShellClassName} pa-global-header-inner`}>
          <Link href={`/${locale}` as Route} className="pa-brand" aria-label={`${t.brand} — ${t.description}`}>
            <span className="pa-brand-mark" aria-hidden="true">{locale === "zh" ? "吱" : "Z"}</span>
            <span>
              <strong>{t.brand}</strong>
              <small>{t.description}</small>
            </span>
          </Link>

          <nav className="pa-desktop-nav" aria-label={t.nav}>
            <Link href={`/${locale}` as Route} aria-current={active === "home" ? "page" : undefined}>{t.home}</Link>
            <Link href={`/${locale}/pandas` as Route} aria-current={active === "atlas" || active === "profile" ? "page" : undefined}>{t.atlas}</Link>
            <Link href={`/${locale}/lineage` as Route} aria-current={active === "lineage" ? "page" : undefined}>{t.lineage}</Link>
            <Link href={`/${locale}/map` as Route} aria-current={active === "map" ? "page" : undefined}>{t.map}</Link>
            {contributeEnabled ? (
              <Link
                href={`/${locale}/contribute` as Route}
                aria-current={active === "contribute" ? "page" : undefined}
              >
                {t.contribute}
              </Link>
            ) : null}
            {feedEnabled ? (
              <Link
                href={`/${locale}/me/feed` as Route}
                aria-current={active === "feed" ? "page" : undefined}
              >
                {t.feed}
              </Link>
            ) : null}
            <Link href={`/${locale}/me/passport` as Route} aria-current={active === "my-pandas" ? "page" : undefined}>{t.myPandas}</Link>
          </nav>

          <div className="pa-header-actions">
            <Link href={languageHref as Route} hrefLang={languageHrefLang} className="pa-language-link">
              {t.language}
            </Link>
            <MobileNavigation
              locale={locale}
              languageHref={languageHref}
              languageHrefLang={languageHrefLang}
              feedEnabled={feedEnabled}
              contributeEnabled={contributeEnabled}
              labels={{
                open: t.open,
                close: t.close,
                navigation: t.mobileNav,
                home: t.home,
                atlas: t.atlas,
                lineage: t.lineage,
                map: t.map,
                myPandas: t.myPandas,
                feed: t.feed,
                contribute: t.contribute,
                language: t.language,
              }}
            />
          </div>
        </div>
      </header>
    </>
  );
}
