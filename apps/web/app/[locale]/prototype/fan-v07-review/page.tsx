import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { parsePublicLocale } from "@/foundation/content/locales";

import { ReviewShell } from "./review-shell";
import styles from "./review.module.css";

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "ZhiPanda V0.7 subpage review",
  robots: { index: false, follow: false },
};

export default async function FanV07ReviewIndex({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const base = `/${locale}/prototype/fan-v07-review`;
  const pages = [
    {
      id: "01",
      title: zh ? "熊猫图鉴" : "Panda directory",
      body: zh ? "照片优先的列表页：搜索与筛选在前，但 Spotlight 和大图网格才是浏览主角。" : "A photo-first directory where search stays useful without overpowering Spotlight and the image grid.",
      href: `${base}/pandas`,
    },
    {
      id: "02",
      title: zh ? "熊猫家族" : "Panda families",
      body: zh ? "先用故事和大图理解一个家族，再把精确关系交给谱系工具。" : "Understand a family through story and photography first, then move to lineage for exact relationships.",
      href: `${base}/families`,
    },
    {
      id: "03",
      title: zh ? "熊猫时光" : "Panda moments",
      body: zh ? "按年份和月份浏览生日、出生、迁居、返回和公开事件，把数据库事件变成可逛的时间内容。" : "Browse birthdays, births, moves, returns, and public events through a chronological editorial surface.",
      href: `${base}/moments`,
    },
    {
      id: "04",
      title: zh ? "我的熊猫" : "My Pandas",
      body: zh ? "把收藏、见过、去过和游戏记录收回到一个私人的熊猫空间。" : "Bring favorites, sightings, visits, and play history into one private panda space.",
      href: `${base}/me`,
    },
  ];

  return (
    <ReviewShell locale={locale}>
      <main className={styles.main}>
        <div className={styles.shell}>
          <section className={styles.indexHero}>
            <h1 className={styles.display}>{zh ? "V0.7 子页面恢复评审" : "V0.7 recovered subpages"}</h1>
            <p>{zh ? "这不是 V8 重设计，而是把当时已经做过的四个普通熊猫爱好者核心页面恢复成可直接浏览的现代 Next 版本。先判断哪些结构值得保留，再逐页进入 V8。" : "This is not the V8 redesign. It restores four fan-first V0.7 surfaces into a modern browseable Next implementation so we can decide what deserves to survive into V8."}</p>
          </section>
          <section className={styles.indexGrid}>
            {pages.map((item) => (
              <Link key={item.id} className={styles.indexCard} href={item.href as Route}>
                <div>
                  <small>{item.id}</small>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                </div>
                <span>{zh ? "打开页面" : "Open page"}<ArrowRight aria-hidden="true" /></span>
              </Link>
            ))}
          </section>
        </div>
      </main>
    </ReviewShell>
  );
}
