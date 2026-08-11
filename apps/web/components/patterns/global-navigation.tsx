import type { Route } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { PublicLocale } from "@/foundation/content/locales";
import { alternateLocale } from "@/foundation/content/locales";
import { MobileNavigation } from "@/components/patterns/mobile-navigation";
import { isCommunityIntakeUiEnabled } from "@/features/contribute/config";
import { isNotificationCenterEnabled } from "@/features/notification-center/config";

interface GlobalNavigationProps {
  locale: PublicLocale;
  active:
    | "home"
    | "atlas"
    | "profile"
    | "moments"
    | "families"
    | "map"
    | "games"
    | "my-pandas"
    | "feed"
    | "contribute"
    | "inbox";
  alternatePath?: string;
}

const copy = {
  zh: {
    brand: "吱熊猫",
    description: "发现熊猫、家族与足迹",
    home: "首页",
    atlas: "熊猫",
    moments: "熊猫时光",
    families: "家族",
    map: "地图",
    games: "游戏",
    myPandas: "我的熊猫",
    contribute: "贡献资料",
    inbox: "通知",
    inboxAria: "打开我的通知",
    nav: "主导航",
    mobileNav: "移动导航",
    open: "打开导航菜单",
    close: "关闭导航菜单",
    language: "English",
  },
  en: {
    brand: "ZhiPanda",
    description: "Discover pandas, families, and journeys",
    home: "Home",
    atlas: "Pandas",
    moments: "Moments",
    families: "Families",
    map: "Map",
    games: "Games",
    myPandas: "My Pandas",
    contribute: "Contribute",
    inbox: "Notifications",
    inboxAria: "Open my notifications",
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
  const contributeEnabled = isCommunityIntakeUiEnabled();
  const notificationCenterEnabled = isNotificationCenterEnabled();
  const myPandasActive = active === "my-pandas" || active === "feed" || active === "inbox";

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
            <Link href={`/${locale}/moments` as Route} aria-current={active === "moments" ? "page" : undefined}>{t.moments}</Link>
            <Link href={`/${locale}/families` as Route} aria-current={active === "families" ? "page" : undefined}>{t.families}</Link>
            <Link href={`/${locale}/map` as Route} aria-current={active === "map" ? "page" : undefined}>{t.map}</Link>
            <Link href={`/${locale}/games` as Route} aria-current={active === "games" ? "page" : undefined}>{t.games}</Link>
            {contributeEnabled ? (
              <Link
                href={`/${locale}/contribute` as Route}
                aria-current={active === "contribute" ? "page" : undefined}
              >
                {t.contribute}
              </Link>
            ) : null}
            <Link href={`/${locale}/me` as Route} aria-current={myPandasActive ? "page" : undefined}>{t.myPandas}</Link>
          </nav>

          <div className="pa-header-actions">
            {notificationCenterEnabled ? (
              <Link
                href={`/${locale}/me/inbox` as Route}
                className="pa-icon-button"
                aria-label={t.inboxAria}
                title={t.inbox}
              >
                <Bell aria-hidden="true" />
              </Link>
            ) : null}
            <Link href={languageHref as Route} hrefLang={languageHrefLang} className="pa-language-link">
              {t.language}
            </Link>
            <MobileNavigation
              locale={locale}
              languageHref={languageHref}
              languageHrefLang={languageHrefLang}
              contributeEnabled={contributeEnabled}
              labels={{
                open: t.open,
                close: t.close,
                navigation: t.mobileNav,
                home: t.home,
                atlas: t.atlas,
                moments: t.moments,
                families: t.families,
                map: t.map,
                games: t.games,
                myPandas: t.myPandas,
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
