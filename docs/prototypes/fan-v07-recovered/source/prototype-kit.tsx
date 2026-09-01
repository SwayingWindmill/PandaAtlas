import type { Route } from "next";
import Link from "next/link";
import { Heart, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaDetail } from "@/lib/types";

import { PrototypeMotionRoot } from "./prototype-motion-root";
import styles from "./prototype.module.css";

export function pandaName(panda: PandaDetail, locale: PublicLocale): string {
  return locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
}

export function pandaAltName(panda: PandaDetail, locale: PublicLocale): string | null {
  const alt = locale === "zh" ? panda.name_en : panda.name_zh;
  return alt && alt !== pandaName(panda, locale) ? alt : null;
}

export function pandaPhotoAlt(panda: PandaDetail, locale: PublicLocale): string {
  const media = panda.media.find((item) => item.url === panda.cover_image_url);
  return (locale === "zh" ? media?.alt_zh : media?.alt_en)
    ?? (locale === "zh" ? `${pandaName(panda, locale)}的公开照片` : `Published photograph of ${pandaName(panda, locale)}`);
}

export function choosePandas(pandas: PandaDetail[], preferred: readonly string[], limit: number): PandaDetail[] {
  const map = new Map(pandas.map((panda) => [panda.slug, panda]));
  const first = preferred.flatMap((slug) => {
    const panda = map.get(slug);
    return panda ? [panda] : [];
  });
  const used = new Set(first.map((panda) => panda.id));
  return [...first, ...pandas.filter((panda) => !used.has(panda.id))].slice(0, limit);
}

type PrototypeNav = "home" | "pandas" | "families" | "moments" | "map" | "games";

export function PrototypeShell({
  locale,
  children,
  active = "home",
  alternatePath,
  immersive = false,
}: {
  locale: PublicLocale;
  children: React.ReactNode;
  active?: PrototypeNav;
  alternatePath?: string;
  immersive?: boolean;
}) {
  const zh = locale === "zh";
  const other = locale === "zh" ? "en" : "zh";
  const nav = [
    { id: "home" as const, href: `/${locale}/prototype/fan-v07`, label: zh ? "发现" : "Discover" },
    { id: "pandas" as const, href: `/${locale}/prototype/fan-v07/pandas`, label: zh ? "全部熊猫" : "Pandas" },
    { id: "families" as const, href: `/${locale}/prototype/fan-v07/families`, label: zh ? "家族" : "Families" },
    { id: "moments" as const, href: `/${locale}/prototype/fan-v07/moments`, label: zh ? "时光" : "Moments" },
    { id: "map" as const, href: `/${locale}/prototype/fan-v07/map`, label: zh ? "地图" : "Map" },
    { id: "games" as const, href: `/${locale}/prototype/fan-v07/games`, label: zh ? "游戏" : "Games" },
  ];
  const languageHref = alternatePath ?? `/${other}/prototype/fan-v07`;

  return (
    <PrototypeMotionRoot>
      <div className={styles.page} data-testid="fan-v07-prototype">
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href={`/${locale}/prototype/fan-v07` as Route} className={styles.brand}>
              <span className={styles.brandMark} aria-hidden="true">●</span>
              <span>{zh ? "吱熊猫" : "ZhiPanda"}</span>
            </Link>
            <nav className={styles.nav} aria-label={zh ? "V0.7 原型导航" : "V0.7 prototype navigation"}>
              {nav.map((item) => (
                <Link key={item.id} className={active === item.id ? styles.navActive : undefined} href={item.href as Route}>{item.label}</Link>
              ))}
            </nav>
            <div className={styles.headerActions}>
              <Button asChild variant="outline" size="sm" className={styles.headerButton}>
                <Link href={`/${locale}/prototype/fan-v07/search` as Route} aria-label={zh ? "搜索" : "Search"}><Search aria-hidden="true" /></Link>
              </Button>
              <Button asChild variant="outline" size="sm" className={styles.headerButton}>
                <Link href={`/${locale}/prototype/fan-v07/me` as Route} aria-label={zh ? "我的熊猫" : "My Pandas"}><Heart aria-hidden="true" /></Link>
              </Button>
              <Link href={languageHref as Route} className={styles.lang}>{other === "zh" ? "中" : "EN"}</Link>
            </div>
          </div>
        </header>
        {children}
        {!immersive ? (
          <footer className={styles.footer}>
            <div><strong>{zh ? "吱熊猫 V0.7" : "ZhiPanda V0.7"}</strong><span>{zh ? "Panda Fan Club 公共页面视觉原型" : "Panda Fan Club public-page prototypes"}</span></div>
            <Link href={`/${locale}` as Route}>{zh ? "返回正式站" : "Back to production"}</Link>
          </footer>
        ) : null}
      </div>
    </PrototypeMotionRoot>
  );
}
