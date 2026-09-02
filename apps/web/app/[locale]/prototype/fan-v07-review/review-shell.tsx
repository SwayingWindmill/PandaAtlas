import type { Route } from "next";
import Link from "next/link";
import { ArrowUpRight, Heart, Search } from "lucide-react";

import type { ReviewLocale } from "./review-data";
import styles from "./review.module.css";

interface ReviewShellProps {
  locale: ReviewLocale;
  active?: "pandas" | "families" | "moments" | "me";
  children: React.ReactNode;
}

export function ReviewShell({ locale, active, children }: ReviewShellProps) {
  const zh = locale === "zh";
  const other = zh ? "en" : "zh";
  const base = `/${locale}/prototype/fan-v07-review`;
  const nav = [
    { id: "pandas", label: zh ? "熊猫图鉴" : "Pandas", href: `${base}/pandas` },
    { id: "families", label: zh ? "家族" : "Families", href: `${base}/families` },
    { id: "moments", label: zh ? "时光" : "Moments", href: `${base}/moments` },
    { id: "me", label: zh ? "我的熊猫" : "My Pandas", href: `${base}/me` },
  ] as const;

  return (
    <div className={styles.page} data-testid="fan-v07-review">
      <header className={styles.header}>
        <Link className={styles.brand} href={base as Route}>
          <span>吱熊猫</span>
          <small>V0.7 REVIEW</small>
        </Link>
        <nav className={styles.nav} aria-label={zh ? "V0.7 子页面评审导航" : "V0.7 subpage review navigation"}>
          {nav.map((item) => (
            <Link key={item.id} href={item.href as Route} aria-current={active === item.id ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Link href={`/${locale}/prototype/fan-v08` as Route} title={zh ? "查看 V8 首页" : "Open V8 home"}>
            <ArrowUpRight aria-hidden="true" />
            <span>{zh ? "V8 首页" : "V8 Home"}</span>
          </Link>
          <Link href={`/${locale}/search` as Route} aria-label={zh ? "搜索" : "Search"}><Search aria-hidden="true" /></Link>
          <Link href={`/${locale}/my-pandas` as Route} aria-label={zh ? "我的熊猫" : "My Pandas"}><Heart aria-hidden="true" /></Link>
          <Link className={styles.language} href={`/${other}/prototype/fan-v07-review${active ? `/${active}` : ""}` as Route}>{zh ? "EN" : "中"}</Link>
        </div>
      </header>
      <div className={styles.reviewNotice}>
        <span>{zh ? "历史设计恢复 · 仅供本地视觉评审" : "Recovered historical design · local visual review only"}</span>
        <span>{zh ? "内容读取当前公开数据；旧版影像 fixture 只用于还原版式。" : "Content uses current public data; historical image fixtures only restore the visual composition."}</span>
      </div>
      {children}
    </div>
  );
}
