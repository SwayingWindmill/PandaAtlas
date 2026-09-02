/* eslint-disable @next/next/no-img-element -- recovered visual review uses explicitly isolated historical photo fixtures. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Bell, BookHeart, Eye, Gamepad2, Heart, MapPinCheck, Settings2 } from "lucide-react";

import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

import { pickPhotographedPandas, reviewImage, reviewImageAlt, reviewName } from "../review-data";
import { ReviewShell } from "../review-shell";
import styles from "../review.module.css";

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "ZhiPanda V0.7 My Pandas review",
  robots: { index: false, follow: false },
};

export default async function FanV07ReviewMe({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const envelope = loadPublishedAtlasDataset(locale);
  const starterPandas = pickPhotographedPandas(envelope.data.pandas, 3);

  const destinations = [
    { icon: BookHeart, title: zh ? "收藏与合集" : "Favorites & collections", body: zh ? "把喜欢的熊猫整理成自己的集合。" : "Organize favorite pandas into personal collections.", href: `/${locale}/me/collections` },
    { icon: Eye, title: zh ? "见过的熊猫" : "Seen pandas", body: zh ? "记录现实中见过哪些熊猫。" : "Remember pandas you have seen in real life.", href: `/${locale}/me/memories` },
    { icon: MapPinCheck, title: zh ? "去过的地点" : "Visited places", body: zh ? "把动物园、基地和旅途变成个人足迹。" : "Turn zoos, bases, and trips into a personal footprint.", href: `/${locale}/me/memories` },
    { icon: Gamepad2, title: zh ? "游戏记录" : "Game history", body: zh ? "回看猜熊猫和其他互动记录。" : "Review Guess Panda and other game activity.", href: `/${locale}/me/game-history` },
    { icon: Bell, title: zh ? "通知" : "Notifications", body: zh ? "把关注熊猫的新动态集中起来。" : "Keep updates from followed pandas together.", href: `/${locale}/me/inbox` },
    { icon: Settings2, title: zh ? "账号与隐私" : "Account & privacy", body: zh ? "昵称、资料和私有数据边界。" : "Nickname, profile, and private-data boundaries.", href: `/${locale}/me` },
  ];

  return (
    <ReviewShell locale={locale} active="me">
      <main className={styles.main}>
        <div className={styles.shell}>
          <section className={styles.meHero}>
            <div className={styles.meCopy}>
              <span className={styles.sectionMeta}>MY PANDAS</span>
              <h1 className={styles.display}>{zh ? "把喜欢、见过和去过，慢慢变成自己的熊猫世界。" : "Turn favorites, sightings, and visits into your own panda world."}</h1>
              <p>{zh ? "V0.7 的判断是：普通爱好者真正会反复回来的，不只是资料页，而是“我关注的熊猫最近怎么样、我收藏了什么、我见过谁”。" : "V0.7 assumed repeat visits would come from a personal relationship with pandas: what followed pandas are doing, what you saved, and whom you have seen."}</p>
              <p className={styles.privacyLine}><Heart aria-hidden="true" />{zh ? "本页是视觉恢复，不读取真实账号数据；正式个人记录默认私有。" : "This review does not read real account data; production personal records remain private by default."}</p>
            </div>
            <div className={styles.meGallery}>
              {starterPandas.map((panda) => (
                <Link key={panda.id} href={`/${locale}/pandas/${panda.slug}` as Route}>
                  {reviewImage(panda) ? <img src={reviewImage(panda) ?? ""} alt={reviewImageAlt(panda, locale)} /> : null}
                  <strong>{reviewName(panda, locale)}</strong>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.meStats} aria-label={zh ? "个人数据区视觉占位" : "Personal data visual placeholders"}>
            <div className={styles.meStat}><strong>—</strong><span>{zh ? "收藏的熊猫" : "Favorite pandas"}</span></div>
            <div className={styles.meStat}><strong>—</strong><span>{zh ? "见过的熊猫" : "Seen pandas"}</span></div>
            <div className={styles.meStat}><strong>—</strong><span>{zh ? "去过的熊猫地点" : "Visited panda places"}</span></div>
          </section>

          <section className={styles.destinations}>
            <div className={styles.directoryHeader}>
              <div><span className={styles.sectionMeta}>YOUR SPACE</span><h2>{zh ? "从一处进入所有个人记录" : "One home for personal panda records"}</h2></div>
              <p>{zh ? "V0.7 把收藏、足迹、通知和游戏从散落的产品入口收回 My Pandas，形成“关注后回来”的闭环。" : "V0.7 brought favorites, footprints, notifications, and games back under My Pandas to create a clear return loop after following a panda."}</p>
            </div>
            <div className={styles.destinationGrid}>
              {destinations.map(({ icon: Icon, title, body, href }) => (
                <Link className={styles.destination} key={title} href={href as Route}>
                  <Icon aria-hidden="true" />
                  <span><strong>{title}</strong><small>{body}</small></span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </ReviewShell>
  );
}
