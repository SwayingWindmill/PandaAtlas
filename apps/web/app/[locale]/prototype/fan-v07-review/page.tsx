import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { parsePublicLocale } from "@/foundation/content/locales";

import { ReviewShell } from "./review-shell";
import styles from "./review.module.css";

interface Props { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "ZhiPanda V0.7 recovered subpages",
  robots: { index: false, follow: false },
};

export default async function FanV07ReviewIndex({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const base = `/${locale}/prototype/fan-v07-review`;

  return (
    <ReviewShell locale={locale}>
      <main className={styles.subPage}>
        <div className={styles.subShell}>
          <section className={styles.pageIntro}>
            <div className={styles.pageIntroRow}>
              <div>
                <h1 className={styles.pageTitle}>{zh ? "V0.7 子页面恢复" : "V0.7 recovered subpages"}</h1>
                <p className={styles.pageDek}>{zh ? "这里直接使用历史 V0.7 原始页面样式与结构，只对已经失效的数据和路由做最小适配。" : "These pages use the original V0.7 structure and styles, with only minimal adaptation for retired data and routes."}</p>
              </div>
              <nav className={styles.filterRow} aria-label={zh ? "恢复页面" : "Recovered pages"}>
                <Link href={`${base}/pandas` as Route}>{zh ? "熊猫图鉴" : "Pandas"}</Link>
                <Link href={`${base}/families` as Route}>{zh ? "家族" : "Families"}</Link>
                <Link href={`${base}/moments` as Route}>{zh ? "时光" : "Moments"}</Link>
                <Link href={`${base}/me` as Route}>{zh ? "我的熊猫" : "My Pandas"}</Link>
              </nav>
            </div>
          </section>
          <section className={styles.directorySection}>
            <div className={styles.directoryHead}>
              <div><p className={styles.sectionLabel}>RECOVERED V0.7</p><h2>{zh ? "先看原版，再决定 V8。" : "Review the original before V8."}</h2></div>
              <p>{zh ? "这次不再重写一套“像 V7”的 CSS。四个页面直接引用保存下来的历史 CSS Module。" : "This pass no longer recreates V7 styling. The four pages directly use the preserved historical CSS Modules."}</p>
            </div>
          </section>
        </div>
      </main>
    </ReviewShell>
  );
}
