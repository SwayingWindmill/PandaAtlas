/* eslint-disable @next/next/no-img-element -- recovered visual review uses explicitly isolated historical photo fixtures. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";

import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

import { fixtureCredit, pickPhotographedPandas, reviewAltName, reviewImage, reviewImageAlt, reviewMeta, reviewName } from "../review-data";
import { ReviewShell } from "../review-shell";
import styles from "../review.module.css";

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "ZhiPanda V0.7 panda directory review",
  robots: { index: false, follow: false },
};

export default async function FanV07ReviewPandas({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const envelope = loadPublishedAtlasDataset(locale);
  const pandas = pickPhotographedPandas(envelope.data.pandas, 25);
  const featured = pandas.find((panda) => reviewImage(panda)) ?? pandas[0] ?? null;
  const rest = pandas.filter((panda) => panda.id !== featured?.id);

  return (
    <ReviewShell locale={locale} active="pandas">
      <main className={styles.main}>
        <div className={styles.shell}>
          <section className={styles.pageIntro}>
            <h1 className={styles.display}>{zh ? "熊猫图鉴" : "Panda directory"}</h1>
            <div className={styles.pageIntroCopy}>
              <p>{zh ? "按名字寻找一只熊猫，或直接从照片开始浏览。V0.7 的核心判断是：搜索和筛选要容易找到，但不能让工具盖过熊猫本身。" : "Search by name or start with a face. V0.7 kept search and filters close at hand without letting tools overpower the pandas themselves."}</p>
              <div className={styles.count}><strong>{envelope.data.pandas.length}</strong><span>{zh ? "当前公开熊猫" : "pandas in the current public release"}</span></div>
            </div>
          </section>

          <div className={styles.searchRow}>
            <form className={styles.searchForm} action={`/${locale}/search`} method="get" role="search">
              <Search aria-hidden="true" />
              <input name="q" type="search" aria-label={zh ? "搜索熊猫" : "Search pandas"} placeholder={zh ? "搜索：美香、福宝、小奇迹……" : "Search: Mei Xiang, Fu Bao, Xiao Qi Ji…"} />
              <button type="submit">{zh ? "搜索" : "Search"}</button>
            </form>
            <nav className={styles.quickFilters} aria-label={zh ? "快速筛选" : "Quick filters"}>
              <Link href={`/${locale}/pandas?status=alive` as Route}>{zh ? "存活" : "Alive"}</Link>
              <Link href={`/${locale}/pandas?sex=female` as Route}>{zh ? "雌性" : "Female"}</Link>
              <Link href={`/${locale}/pandas?sex=male` as Route}>{zh ? "雄性" : "Male"}</Link>
              <Link href={`/${locale}/games/random` as Route}>{zh ? "随机一只" : "Random panda"}</Link>
              <Link href={`/${locale}/pandas` as Route}>{zh ? "完整筛选" : "All filters"}</Link>
            </nav>
          </div>

          {featured ? (
            <section className={styles.spotlight}>
              <div className={styles.spotlightMedia}>
                {reviewImage(featured) ? <img src={reviewImage(featured) ?? ""} alt={reviewImageAlt(featured, locale)} /> : <div className={styles.noPhoto}>{reviewName(featured, locale).slice(0, 1)}</div>}
              </div>
              <div className={styles.spotlightCopy}>
                <small>SPOTLIGHT</small>
                <h2>{reviewName(featured, locale)}</h2>
                {reviewAltName(featured, locale) ? <p>{reviewAltName(featured, locale)}</p> : null}
                <p>{featured.intro ?? (zh ? "从照片、身份、家族、时间和地点继续认识这只熊猫。" : "Continue through photographs, identity, family, time, and place.")}</p>
                <p>{reviewMeta(featured, locale)}</p>
                {fixtureCredit(featured.slug) ? <p className={styles.credit}>{fixtureCredit(featured.slug)}</p> : null}
                <Link className={styles.textLink} href={`/${locale}/pandas/${featured.slug}` as Route}>{zh ? "查看熊猫档案" : "View panda profile"}<ArrowRight aria-hidden="true" /></Link>
              </div>
            </section>
          ) : null}

          <section>
            <div className={styles.directoryHeader}>
              <div><span className={styles.sectionMeta}>BROWSE</span><h2>{zh ? "全部熊猫" : "All pandas"}</h2></div>
              <p>{zh ? "V0.7 已经把“没有授权照片”当作正常档案状态。这里不会用另一只熊猫的照片补洞。" : "V0.7 already treated missing licensed media as a normal record state. Another panda is never used as a substitute image."}</p>
            </div>
            <div className={styles.pandaGrid}>
              {rest.map((panda) => {
                const image = reviewImage(panda);
                return (
                  <Link className={styles.tile} key={panda.id} href={`/${locale}/pandas/${panda.slug}` as Route}>
                    <div className={styles.tileMedia}>{image ? <img src={image} alt={reviewImageAlt(panda, locale)} loading="lazy" /> : <div className={styles.noPhoto}>{reviewName(panda, locale).slice(0, 1)}</div>}</div>
                    <div>
                      <div className={styles.tileTitle}><strong>{reviewName(panda, locale)}</strong><ArrowRight aria-hidden="true" /></div>
                      {reviewAltName(panda, locale) ? <p className={styles.tileAlt}>{reviewAltName(panda, locale)}</p> : null}
                      <p className={styles.tileMeta}>{reviewMeta(panda, locale)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </ReviewShell>
  );
}
