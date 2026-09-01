/* eslint-disable @next/next/no-img-element -- prototype renders current published external panda media directly. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Bell, BookHeart, Eye, Gamepad2, Heart, MapPinCheck, Settings2 } from "lucide-react";

import { MyPandasOverviewIsland } from "@/features/my-pandas/my-pandas-overview-island";
import { MyPandasPassportIsland } from "@/features/my-pandas/my-pandas-passport-island";
import { buildMyPandasViewModel } from "@/features/my-pandas/my-pandas-view-model";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

import { choosePandas, pandaName, pandaPhotoAlt, PrototypeShell } from "../prototype-kit";
import styles from "../subpages.module.css";

interface Props { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "ZhiPanda My Pandas prototype V0.7",
  robots: { index: false, follow: false },
};

export default async function FanV07Me({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const envelope = loadPublishedAtlasDataset(locale);
  const view = buildMyPandasViewModel(envelope.data, locale);
  const prototypeProfiles = view.profiles.map((profile) => ({
    ...profile,
    href: `/${locale}/prototype/fan-v07/panda/${profile.slug}`,
  }));
  const starterPandas = choosePandas(
    envelope.data.pandas.filter((panda) => Boolean(panda.cover_image_url)),
    ["he-hua", "fu-bao", "meng-lan", "mei-xiang", "xiao-qi-ji"],
    3,
  );
  const other = locale === "zh" ? "en" : "zh";

  const destinations = [
    { icon: BookHeart, title: zh ? "收藏与合集" : "Favorites & collections", body: zh ? "把喜欢的熊猫整理成自己的集合。" : "Organize favorite pandas into personal collections.", href: `/${locale}/me/collections` },
    { icon: Eye, title: zh ? "见过的熊猫" : "Seen pandas", body: zh ? "记录现实中见过哪些熊猫。" : "Remember pandas you have seen in real life.", href: `/${locale}/me/memories` },
    { icon: MapPinCheck, title: zh ? "去过的地点" : "Visited places", body: zh ? "把动物园、基地和旅途变成个人足迹。" : "Turn zoos, bases, and trips into a personal footprint.", href: `/${locale}/me/memories` },
    { icon: Gamepad2, title: zh ? "游戏记录" : "Game history", body: zh ? "回看猜熊猫和其他互动记录。" : "Review Guess Panda and other game activity.", href: `/${locale}/me/game-history` },
    { icon: Bell, title: zh ? "通知" : "Notifications", body: zh ? "以后熊猫动态和收藏提醒都收进这里。" : "Keep panda updates and favorite alerts together.", href: `/${locale}/me/inbox` },
    { icon: Settings2, title: zh ? "账号与隐私" : "Account & privacy", body: zh ? "昵称、资料和私有数据边界。" : "Nickname, profile, and private-data boundaries.", href: `/${locale}/me/settings` },
  ];

  return (
    <PrototypeShell locale={locale} alternatePath={`/${other}/prototype/fan-v07/me`}>
      <main className={`${styles.subPage} ${styles.myPandasPrototype}`}>
        <div className={styles.subShell}>
          <section className={styles.myPandasHero}>
            <div className={styles.myPandasHeroCopy}>
              <p className={styles.sectionLabel}>{zh ? "My Pandas · 我的熊猫" : "My Pandas"}</p>
              <h1>{zh ? "把喜欢、见过和去过，慢慢变成自己的熊猫世界。" : "Turn favorites, sightings, and visits into your own panda world."}</h1>
              <p>{zh ? "从喜欢的一只开始。收藏、见过、去过和一起玩过的记录，会慢慢变成只属于你的熊猫世界。" : "Start with one panda you love. Favorites, sightings, visits, and play gradually become a panda world that is yours."}</p>
              <p className={styles.myPandasPrivacyLine}><Heart aria-hidden="true" />{zh ? "账号记录默认私有，不会生成公开主页或排行榜。" : "Account records stay private by default. No public profile or ranking is created."}</p>
            </div>
            <div className={styles.myPandasHeroGallery}>
              <div className={styles.myPandasGalleryHead}>
                <span>{zh ? "从喜欢的一只开始" : "Start with one panda"}</span>
                <small>{zh ? "认识 · 收藏 · 再继续发现" : "Meet · save · keep exploring"}</small>
              </div>
              <div className={styles.myPandasGalleryGrid}>
                {starterPandas.map((panda, index) => (
                  <Link key={panda.id} data-featured={index === 0 ? "true" : undefined} href={`/${locale}/prototype/fan-v07/panda/${panda.slug}` as Route}>
                    <span><img src={panda.cover_image_url ?? ""} alt={pandaPhotoAlt(panda, locale)} /></span>
                    <strong>{pandaName(panda, locale)}</strong>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.myPandasOverviewWrap}>
            <MyPandasOverviewIsland locale={locale} />
          </section>

          <section className={styles.myPandasDestinations}>
            <div className={styles.directoryHead}>
              <div><p className={styles.sectionLabel}>{zh ? "Your space · 你的空间" : "Your space"}</p><h2>{zh ? "从一处进入所有个人记录" : "One home for personal panda records"}</h2></div>
              <p>{zh ? "收藏、足迹、通知和游戏不再散落成同级导航。" : "Favorites, footprints, notifications, and games no longer compete as separate top-level products."}</p>
            </div>
            <div className={styles.myPandasDestinationLayout}>
              <div className={styles.myPandasPrimaryRoutes}>
                {destinations.slice(0, 3).map(({ icon: Icon, title, body, href }) => (
                  <Link key={title} href={href as Route}>
                    <Icon aria-hidden="true" />
                    <span><strong>{title}</strong><small>{body}</small></span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <div className={styles.myPandasSupportRoutes}>
                {destinations.slice(3).map(({ icon: Icon, title, body, href }) => (
                  <Link key={title} href={href as Route}>
                    <Icon aria-hidden="true" />
                    <span><strong>{title}</strong><small>{body}</small></span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.myPandasPassportWrap}>
            <MyPandasPassportIsland locale={locale} profiles={prototypeProfiles} copy={view.copy} />
          </section>
        </div>
      </main>
    </PrototypeShell>
  );
}
