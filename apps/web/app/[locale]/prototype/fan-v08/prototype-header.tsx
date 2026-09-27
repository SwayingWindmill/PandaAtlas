import type { Route } from "next";
import Link from "next/link";

import { ZhiPandaLogo } from "@/components/brand/zhipanda-logo";

import styles from "./prototype.module.css";

type ActiveSection = "pandas" | "families" | "map" | "moments";

interface PrototypeHeaderProps {
  locale: "zh" | "en";
  active?: ActiveSection;
  languageHref: string;
  searchHref?: string;
}

function route(value: string): Route {
  return value as Route;
}

export function PrototypeHeader({
  locale,
  active,
  languageHref,
  searchHref = `/${locale}/prototype/fan-v08/pandas#directory-search`,
}: PrototypeHeaderProps) {
  const zh = locale === "zh";
  const items: Array<{ id: ActiveSection; href: string; zh: string; en: string }> = [
    { id: "pandas", href: `/${locale}/prototype/fan-v08/pandas`, zh: "熊猫", en: "Pandas" },
    { id: "families", href: `/${locale}/families`, zh: "家族", en: "Families" },
    { id: "map", href: `/${locale}/map`, zh: "地图", en: "Map" },
    { id: "moments", href: `/${locale}/moments`, zh: "动态", en: "Moments" },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href={route(`/${locale}/prototype/fan-v08`)}>
          <ZhiPandaLogo locale={locale} />
        </Link>

        <nav className={styles.nav} aria-label={zh ? "主导航" : "Main navigation"}>
          {items.map((item) => (
            <Link key={item.id} href={route(item.href)} aria-current={active === item.id ? "page" : undefined}>
              {zh ? item.zh : item.en}
            </Link>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <Link className={styles.languageAction} href={route(languageHref)}>
            {zh ? "EN" : "中文"}
          </Link>
          <Link className={styles.myPandasAction} href={route(`/${locale}/my-pandas`)}>
            {zh ? "我的熊猫" : "My Pandas"}
          </Link>
          <Link className={styles.searchAction} href={route(searchHref)}>
            {zh ? "找熊猫" : "FIND A PANDA"}
          </Link>
        </div>
      </div>
    </header>
  );
}
