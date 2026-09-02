/* eslint-disable @next/next/no-img-element -- recovered V0.7 review uses explicit historical media fixtures. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

import { withReviewVisuals } from "../review-data";
import { choosePandas, pandaAltName, pandaName, pandaPhotoAlt, ReviewShell } from "../review-shell";
import styles from "../review.module.css";

interface Props { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "ZhiPanda panda directory prototype V0.7",
  robots: { index: false, follow: false },
};

const preferred = ["he-hua", "fu-bao", "mei-xiang", "meng-lan", "xiang-xiang", "xiao-qi-ji", "bao-bao", "bei-bei", "ya-lun", "xi-lun", "shin-shin", "ri-ri", "xiao-xiao", "lei-lei", "tian-tian", "yang-guang"] as const;

function statusLabel(status: string, zh: boolean): string {
  if (status === "alive") return zh ? "存活" : "Alive";
  if (status === "deceased") return zh ? "已死亡" : "Deceased";
  return zh ? "状态未知" : "Unknown status";
}

function genderLabel(gender: string, zh: boolean): string {
  if (gender === "female") return zh ? "雌性" : "Female";
  if (gender === "male") return zh ? "雄性" : "Male";
  return zh ? "未知" : "Unknown";
}

export default async function FanV07ReviewPandas({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const atlas = loadPublishedAtlasDataset(locale);
  const visualPandas = withReviewVisuals(atlas.data.pandas);
  const photographed = visualPandas.filter((panda) => Boolean(panda.cover_image_url));
  const pandas = choosePandas(photographed, preferred, 25);
  const featured = pandas[0] ?? null;

  return (
    <ReviewShell locale={locale} active="pandas">
      <main className={styles.subPage}>
        <div className={styles.subShell}>
          <section className={styles.pageIntro}>
            <div className={styles.pageIntroRow}>
              <div>
                <h1 className={styles.pageTitle}>{zh ? "熊猫图鉴" : "Panda directory"}</h1>
                <p className={styles.pageDek}>{zh ? "按名字寻找一只熊猫，或直接从照片开始浏览。这里把搜索和筛选放在前面，但不让工具盖过熊猫本身。" : "Search by name or simply start with a face. Search and filters are easy to reach without overpowering the pandas themselves."}</p>
                <p className={styles.countNote}>{zh ? `当前公开收录 ${atlas.data.pandas.length} 只熊猫` : `${atlas.data.pandas.length} pandas in the current public release`}</p>
              </div>
              <div>
                <form className={styles.searchBar} action={`/${locale}/search`} method="get" role="search">
                  <Search aria-hidden="true" />
                  <Input name="q" type="search" aria-label={zh ? "搜索熊猫" : "Search pandas"} placeholder={zh ? "搜索：美香、和花、福宝……" : "Search: Mei Xiang, He Hua, Fu Bao…"} />
                  <Button type="submit">{zh ? "搜索" : "Search"}</Button>
                </form>
                <nav className={styles.filterRow} aria-label={zh ? "快速筛选" : "Quick filters"}>
                  <Link href={`/${locale}/pandas?status=alive` as Route}>{zh ? "存活" : "Alive"}</Link>
                  <Link href={`/${locale}/pandas?sex=female` as Route}>{zh ? "雌性" : "Female"}</Link>
                  <Link href={`/${locale}/pandas?sex=male` as Route}>{zh ? "雄性" : "Male"}</Link>
                  <Link href={`/${locale}/games/random` as Route}>{zh ? "随机一只" : "Random panda"}</Link>
                  <Link href={`/${locale}/pandas` as Route}>{zh ? "完整筛选" : "All filters"}</Link>
                </nav>
              </div>
            </div>
          </section>

          {featured ? (
            <section className={styles.spotlight}>
              <p className={styles.sectionLabel}>{zh ? "Spotlight · 今天先认识" : "Spotlight"}</p>
              <div className={styles.spotlightCard}>
                <div className={styles.spotlightMedia}><img src={featured.cover_image_url ?? ""} alt={pandaPhotoAlt(featured, locale)} /></div>
                <div className={styles.spotlightCopy}>
                  <small>{zh ? "熊猫 Spotlight" : "Panda spotlight"}</small>
                  <h2>{pandaName(featured, locale)}</h2>
                  {pandaAltName(featured, locale) ? <p className={styles.spotlightAlt}>{pandaAltName(featured, locale)}</p> : null}
                  <p className={styles.spotlightSummary}>{featured.intro ?? (zh ? "从照片、身份、家族、时间和地点继续认识这只熊猫。" : "Continue through photographs, identity, family, time, and place.")}</p>
                  <p className={styles.spotlightMeta}>{[
                    genderLabel(featured.gender, zh),
                    featured.birth_date?.slice(0, 4),
                    featured.current_location,
                    statusLabel(featured.status, zh),
                  ].filter(Boolean).join(" · ")}</p>
                  <Link className={styles.textAction} href={`/${locale}/pandas/${featured.slug}` as Route}>{zh ? "查看熊猫档案" : "View panda profile"}<ArrowRight aria-hidden="true" /></Link>
                </div>
              </div>
            </section>
          ) : null}

          <section className={styles.directorySection}>
            <div className={styles.directoryHead}>
              <div><p className={styles.sectionLabel}>{zh ? "Browse · 浏览" : "Browse"}</p><h2>{zh ? "全部熊猫" : "All pandas"}</h2></div>
              <p>{zh ? "照片、名字和少量关键信息保持同一层级，方便快速扫视。" : "Consistent cards keep photographs, names, and essential metadata easy to scan."}</p>
            </div>
            <div className={styles.pandaGrid}>
              {pandas.slice(featured ? 1 : 0).map((panda) => (
                <Link className={styles.pandaCard} key={panda.id} href={`/${locale}/pandas/${panda.slug}` as Route}>
                  <div className={styles.pandaCardMedia}>{panda.cover_image_url ? <img src={panda.cover_image_url} alt={pandaPhotoAlt(panda, locale)} loading="lazy" /> : null}</div>
                  <div className={styles.pandaCardBody}>
                    <div className={styles.pandaCardTitle}><strong>{pandaName(panda, locale)}</strong><ArrowRight aria-hidden="true" /></div>
                    {pandaAltName(panda, locale) ? <p className={styles.pandaCardAlt}>{pandaAltName(panda, locale)}</p> : null}
                    <p className={styles.pandaCardMeta}>{[panda.birth_date?.slice(0, 4), panda.current_location, statusLabel(panda.status, zh)].filter(Boolean).join(" · ")}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </ReviewShell>
  );
}
