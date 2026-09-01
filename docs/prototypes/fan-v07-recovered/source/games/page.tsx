/* eslint-disable @next/next/no-img-element -- prototype renders published external panda media directly. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Dices, Eye, FileQuestion } from "lucide-react";

import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

import { choosePandas, pandaName, pandaPhotoAlt, PrototypeShell } from "../prototype-kit";
import styles from "../subpages.module.css";

interface Props { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "ZhiPanda games prototype V0.7",
  robots: { index: false, follow: false },
};

const preferred = ["meng-lan", "fu-bao", "xiang-xiang", "xiao-qi-ji", "mei-xiang"] as const;

export default async function FanV07Games({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const atlas = loadPublishedAtlasDataset(locale);
  const pandas = choosePandas(atlas.data.pandas.filter((panda) => Boolean(panda.cover_image_url)), preferred, 4);
  const randomPanda = pandas[0] ?? null;
  const guessPanda = pandas[1] ?? pandas[0] ?? null;
  const other = locale === "zh" ? "en" : "zh";

  return (
    <PrototypeShell locale={locale} active="games" alternatePath={`/${other}/prototype/fan-v07/games`}>
      <main className={styles.subPage}>
        <div className={styles.subShell}>
          <section className={styles.gamesHero}>
            <p className={styles.sectionLabel}>{zh ? "Play · 熊猫游戏" : "Play · Panda games"}</p>
            <h1>{zh ? "有时候，不查资料。先玩一会儿。" : "Sometimes, skip the research and just play."}</h1>
            <p>{zh ? "小游戏不应该像另一个产品后台。它们用同一份熊猫资料和公开照片，让用户在轻松互动里记住更多熊猫。" : "Games should not feel like another product dashboard. They use the same panda records and published photography to help people remember more individuals through light interaction."}</p>
          </section>

          <section className={styles.gameStageGrid}>
            <article className={styles.gameFeature}>
              {randomPanda?.cover_image_url ? <img src={randomPanda.cover_image_url} alt={pandaPhotoAlt(randomPanda, locale)} /> : null}
              <span className={styles.gameFeatureShade} aria-hidden="true" />
              <div className={styles.gameFeatureCopy}>
                <Dices aria-hidden="true" />
                <small>{zh ? "RANDOM PANDA" : "RANDOM PANDA"}</small>
                <h2>{zh ? "随机遇见一只" : "Meet one at random"}</h2>
                <p>{zh ? "不知道下一只是谁，先从照片、名字和现在公开地点认识 TA。" : "You do not know who comes next. Start with a face, name, and published place."}</p>
                <Link href={`/${locale}/games/random` as Route}>{zh ? "随机一只" : "Pick a panda"}<ArrowRight aria-hidden="true" /></Link>
              </div>
            </article>

            <article className={styles.gameFeature}>
              {guessPanda?.cover_image_url ? <img src={guessPanda.cover_image_url} alt={pandaPhotoAlt(guessPanda, locale)} /> : null}
              <span className={styles.gameFeatureShade} aria-hidden="true" />
              <div className={styles.gameFeatureCopy}>
                <FileQuestion aria-hidden="true" />
                <small>{zh ? "GUESS THE PANDA" : "GUESS THE PANDA"}</small>
                <h2>{zh ? "你认得它吗？" : "Do you know this panda?"}</h2>
                <p>{zh ? "只看一张公开照片做选择，答完立刻回到这只熊猫的真实档案。" : "Identify a panda from one published photo, then jump straight into its real profile."}</p>
                <Link href={`/${locale}/games/guess` as Route}>{zh ? "开始猜" : "Start guessing"}<ArrowRight aria-hidden="true" /></Link>
              </div>
            </article>
          </section>

          <section className={styles.gamesFooterBand}>
            <Eye aria-hidden="true" />
            <div><strong>{zh ? "游戏的终点还是认识熊猫。" : "Every game should end by meeting the panda."}</strong><p>{zh ? "不做排行榜和每日任务墙；答题、随机遇见和未来的照片玩法都应该把用户送回个体档案、家族与地点。" : "No leaderboard or daily-task wall. Guessing, random discovery, and future photo games should always lead back to profiles, families, and places."}</p></div>
            <Link href={`/${locale}/prototype/fan-v07/pandas` as Route}>{zh ? "回到熊猫图鉴" : "Back to panda directory"}<ArrowRight aria-hidden="true" /></Link>
          </section>
        </div>
      </main>
    </PrototypeShell>
  );
}
