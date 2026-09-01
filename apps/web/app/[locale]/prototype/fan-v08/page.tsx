/* eslint-disable @next/next/no-img-element -- design prototype intentionally renders reviewed external visual fixtures. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Dices,
  Heart,
  MapPin,
  Search,
  Shuffle,
  UsersRound,
} from "lucide-react";

import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";

import styles from "./prototype.module.css";
import { fanV08VisualFixtures } from "./visual-fixtures";

interface Props {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "ZhiPanda Fan V8 Home Prototype",
  description: "Fan-first immersive homepage design prototype.",
  robots: { index: false, follow: false },
};

function route(value: string): Route {
  return value as Route;
}

function displayName(locale: "zh" | "en", zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}

function eventCopy(locale: "zh" | "en") {
  return locale === "zh"
    ? [
        { year: "1998", type: "出生", body: "7 月 22 日出生于中国。" },
        { year: "2000", type: "来到华盛顿", body: "12 月开始在史密森国家动物园生活。" },
        { year: "2023", type: "返回中国", body: "11 月与添添、小奇迹一起离开华盛顿。" },
      ]
    : [
        { year: "1998", type: "Born", body: "Born in China on July 22." },
        { year: "2000", type: "Washington", body: "Began living at the Smithsonian in December." },
        { year: "2023", type: "Returned to China", body: "Left Washington with Tian Tian and Xiao Qi Ji in November." },
      ];
}

const familyMembers = [
  { slug: "bao-bao", zh: "宝宝", en: "Bao Bao", relationZh: "女儿", relationEn: "Daughter" },
  { slug: "bei-bei", zh: "贝贝", en: "Bei Bei", relationZh: "儿子", relationEn: "Son" },
  { slug: "xiao-qi-ji", zh: "小奇迹", en: "Xiao Qi Ji", relationZh: "儿子", relationEn: "Son" },
];

export default async function FanV08HomePrototype({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const zh = locale === "zh";
  const atlas = await loadV2PublicAtlasDataset(locale);
  const publishedCount = atlas?.data.pandas.length ?? 0;
  const hero = fanV08VisualFixtures[0];
  const panorama = fanV08VisualFixtures.slice(1);
  const moments = eventCopy(locale);
  const atlasPreview = atlas?.data.pandas.slice(0, 3) ?? [];

  return (
    <div className={styles.page} data-testid="fan-v08-prototype">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href={route(`/${locale}`)}>
            <span className={styles.brandMark}>●</span>
            <span>吱熊猫 ZhiPanda</span>
          </Link>
          <nav className={styles.nav} aria-label={zh ? "V8 原型主导航" : "V8 prototype navigation"}>
            <Link href={route(`/${locale}/pandas`)}>{zh ? "熊猫" : "Pandas"}</Link>
            <Link href={route(`/${locale}/families`)}>{zh ? "家族" : "Families"}</Link>
            <Link href={route(`/${locale}/map`)}>{zh ? "地图" : "Map"}</Link>
            <Link href={route(`/${locale}/moments`)}>{zh ? "动态" : "Moments"}</Link>
          </nav>
          <div className={styles.headerActions}>
            <Link className={styles.roundButton} href={route(`/${locale}/pandas`)} aria-label={zh ? "搜索" : "Search"}><Search /></Link>
            <Link className={styles.roundButton} href={route(`/${locale}/my-pandas`)} aria-label={zh ? "我的熊猫" : "My Pandas"}><Heart /></Link>
            <Link className={styles.lang} href={route(`/${locale === "zh" ? "en" : "zh"}/prototype/fan-v08`)}>{locale === "zh" ? "EN" : "中"}</Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="v8-home-title">
          <img className={styles.heroImage} src={hero.image} alt={zh ? `${hero.zh}的照片` : `Photograph of ${hero.en}`} />
          <div className={styles.heroShade} />
          <div className={styles.prototypeFlag}>{zh ? "V8 视觉原型 · 图片为评审 fixture" : "V8 visual prototype · review image fixture"}</div>

          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{zh ? "从一只熊猫开始" : "Start with one panda"}</p>
            <h1 id="v8-home-title">{zh ? "从一只熊猫，走进整个世界。" : "One panda can open an entire world."}</h1>
            <p>{zh ? "家族、地点、时间和记忆，都从同一个名字开始。" : "Family, places, time, and memories all begin with one name."}</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href={route(`/${locale}/pandas/${hero.slug}`)}>
                {zh ? `认识${hero.zh}` : `Meet ${hero.en}`}<ArrowUpRight />
              </Link>
              <Link className={styles.secondaryButton} href={route(`/${locale}/games/random`)}>
                <Shuffle />{zh ? "换一只看看" : "Meet another"}
              </Link>
            </div>
          </div>

          <Link className={styles.heroIdentity} href={route(`/${locale}/pandas/${hero.slug}`)}>
            <span>{zh ? "今天从这里开始" : "Start here today"}</span>
            <strong>{displayName(locale, hero.zh, hero.en)}</strong>
            <em>{zh ? hero.metaZh : hero.metaEn}</em>
            <ArrowUpRight />
          </Link>

          <div className={styles.publishedCount}>
            <strong>{publishedCount || "—"}</strong>
            <span>{zh ? "只当前公开档案" : "profiles in the active release"}</span>
          </div>
          <div className={styles.scrollCue}><ArrowDown />{zh ? "沿着美香继续" : "Follow Mei Xiang"}</div>
          <a className={styles.credit} href={hero.source} target="_blank" rel="noreferrer">{hero.credit} · {hero.rights}</a>
        </section>

        <section className={styles.threadScene}>
          <div className={styles.shell}>
            <div className={styles.threadIntro}>
              <p>{zh ? "一只熊猫，不只是几行资料" : "More than a few facts"}</p>
              <h2>{zh ? "先记住它的几个瞬间。" : "Remember a few moments first."}</h2>
            </div>

            <div className={styles.threadGrid}>
              <aside className={styles.identityCard}>
                <span>{zh ? "主角" : "Featured panda"}</span>
                <strong>{displayName(locale, hero.zh, hero.en)}</strong>
                <p>{zh ? "雌性 · 1998 年出生" : "Female · born 1998"}</p>
                <Link href={route(`/${locale}/pandas/${hero.slug}`)}>{zh ? "打开完整档案" : "Open full profile"}<ArrowRight /></Link>
                <div className={styles.miniFaces}>
                  {fanV08VisualFixtures.slice(2, 6).map((panda) => (
                    <span key={panda.slug} title={displayName(locale, panda.zh, panda.en)}><img src={panda.image} alt="" /></span>
                  ))}
                </div>
              </aside>

              <ol className={styles.timeline}>
                {moments.map((moment) => (
                  <li key={`${moment.year}-${moment.type}`}>
                    <span>{moment.year}</span>
                    <strong>{moment.type}</strong>
                    <p>{moment.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className={styles.familyScene}>
          <img className={styles.familyBackground} src="https://upload.wikimedia.org/wikipedia/commons/2/2c/Mei_Xiang_%2813047314694%29.jpg" alt="" />
          <div className={styles.familyShade} />
          <div className={styles.familyContent}>
            <p className={styles.kicker}>{zh ? "家族" : "Family"}</p>
            <h2>{zh ? "美香不是一个孤立的名字。" : "Mei Xiang is not an isolated name."}</h2>
            <p>{zh ? "沿着孩子、父母与兄弟姐妹，档案会变成一整个家族故事。" : "Follow children, parents, and siblings and a profile becomes a family story."}</p>
            <Link className={styles.yellowButton} href={route(`/${locale}/families`)}>{zh ? "进入这个家族" : "Enter this family"}<ArrowRight /></Link>

            <div className={styles.familyStrip}>
              <div className={styles.familyRoot}>
                <span><img src={hero.image} alt="" /></span>
                <strong>{displayName(locale, hero.zh, hero.en)}</strong>
                <em>{zh ? "母亲" : "Mother"}</em>
              </div>
              <i aria-hidden="true" />
              {familyMembers.map((member) => {
                const visual = fanV08VisualFixtures.find((item) => item.slug === member.slug);
                return (
                  <Link key={member.slug} href={route(`/${locale}/pandas/${member.slug}`)}>
                    <span>{visual ? <img src={visual.image} alt="" /> : <b>{displayName(locale, member.zh, member.en).slice(0, 1)}</b>}</span>
                    <strong>{displayName(locale, member.zh, member.en)}</strong>
                    <em>{zh ? member.relationZh : member.relationEn}</em>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.journeyScene}>
          <div className={`${styles.shell} ${styles.journeyGrid}`}>
            <div className={styles.journeyCopy}>
              <p className={styles.kicker}>{zh ? "生活足迹" : "Journey"}</p>
              <h2>{zh ? "从它生活过的地方，继续认识更多熊猫。" : "Follow where it lived, then meet more pandas."}</h2>
              <p>{zh ? "地点不是一枚孤立的图钉。它把一只熊猫的时间、迁居和同一地点里的其他熊猫连起来。" : "A place is more than a pin. It connects time, movement, and other pandas that shared the same place."}</p>
              <div className={styles.placeList}>
                <div><span>2000 — 2023</span><strong>{zh ? "史密森国家动物园" : "Smithsonian's National Zoo"}</strong><em>{zh ? "历史居住" : "Historic"}</em></div>
                <div><span>2023 —</span><strong>{zh ? "中国" : "China"}</strong><em>{zh ? "公开记录" : "Published record"}</em></div>
              </div>
              <Link className={styles.textLink} href={route(`/${locale}/map`)}>{zh ? "打开熊猫地图" : "Open the panda map"}<ArrowRight /></Link>
            </div>

            <div className={styles.mapMock} aria-label={zh ? "地图视觉原型" : "Map visual prototype"}>
              <div className={styles.mapGrid} />
              <span className={`${styles.mapDot} ${styles.mapDotWashington}`}><i /><b>{zh ? "华盛顿" : "Washington"}</b></span>
              <span className={`${styles.mapDot} ${styles.mapDotChina}`}><i /><b>{zh ? "中国" : "China"}</b></span>
              <svg viewBox="0 0 1000 620" aria-hidden="true"><path d="M220 275 C380 190, 540 185, 760 305" /></svg>
              <div className={styles.mapCard}><MapPin /><div><strong>{zh ? "一只熊猫的足迹" : "One panda's journey"}</strong><span>{zh ? "从华盛顿回到中国" : "From Washington back to China"}</span></div><ArrowUpRight /></div>
            </div>
          </div>
        </section>

        <section className={styles.worldScene}>
          <div className={styles.shell}>
            <div className={styles.worldHeading}>
              <div>
                <p className={styles.kicker}>{zh ? "然后，世界打开" : "Then the world opens"}</p>
                <h2>{zh ? `${publishedCount || "更多"} 只公开熊猫，等你继续认识。` : `${publishedCount || "More"} published pandas to keep discovering.`}</h2>
              </div>
              <Link href={route(`/${locale}/pandas`)}>{zh ? "浏览全部熊猫" : "Browse all pandas"}<ArrowRight /></Link>
            </div>
          </div>

          <div className={styles.panorama}>
            {panorama.map((panda, index) => (
              <Link key={panda.slug} className={styles.panoramaItem} href={route(`/${locale}/pandas/${panda.slug}`)}>
                <img src={panda.image} alt={zh ? `${panda.zh}的照片` : `Photograph of ${panda.en}`} />
                <span className={styles.panoramaShade} />
                <span className={styles.panoramaLabel}>
                  <span><strong>{displayName(locale, panda.zh, panda.en)}</strong><em>{zh ? panda.metaZh : panda.metaEn}</em></span>
                  <ArrowUpRight />
                </span>
                {index === 0 ? <small>{zh ? "横向滑动继续" : "Scroll sideways"}</small> : null}
              </Link>
            ))}
          </div>

          <div className={`${styles.shell} ${styles.discoveryRail}`}>
            <form className={styles.searchBox} action={`/${locale}/pandas`} method="get" role="search">
              <Search />
              <input name="q" type="search" aria-label={zh ? "搜索熊猫" : "Search pandas"} placeholder={zh ? "搜名字：美香、花花、福宝……" : "Search Mei Xiang, He Hua, Fu Bao…"} />
              <button type="submit">{zh ? "搜索" : "Search"}</button>
            </form>
            <nav className={styles.browseLinks} aria-label={zh ? "更多探索方式" : "More ways to explore"}>
              <Link href={route(`/${locale}/pandas`)}>{zh ? "全部熊猫" : "Pandas"}<ArrowRight /></Link>
              <Link href={route(`/${locale}/families`)}><UsersRound />{zh ? "家族" : "Families"}<ArrowRight /></Link>
              <Link href={route(`/${locale}/map`)}><MapPin />{zh ? "地点" : "Places"}<ArrowRight /></Link>
              <Link href={route(`/${locale}/moments`)}><CalendarDays />{zh ? "动态" : "Moments"}<ArrowRight /></Link>
            </nav>
            <div className={styles.playLinks}>
              <Link href={route(`/${locale}/games/random`)}><Dices />{zh ? "随机遇见一只" : "Meet one at random"}</Link>
              <Link href={route(`/${locale}/games/guess`)}>{zh ? "猜猜是哪只熊猫" : "Guess the panda"}<ArrowRight /></Link>
            </div>
          </div>
        </section>

        <section className={styles.returnScene}>
          <div className={`${styles.shell} ${styles.returnGrid}`}>
            <div>
              <p className={styles.kicker}>{zh ? "回来看看" : "Come back"}</p>
              <h2>{zh ? "今天认识一只，明天还有新的故事。" : "Meet one today. There is another story tomorrow."}</h2>
              <div className={styles.updateList}>
                {(atlasPreview.length ? atlasPreview : []).map((panda) => (
                  <Link key={panda.id} href={route(`/${locale}/pandas/${panda.slug}`)}>
                    <span><strong>{locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh}</strong><em>{panda.birth_date?.slice(0, 4) ?? (zh ? "年份待补" : "Year pending")}</em></span>
                    <p>{zh ? "继续查看它的公开档案、家族和生活地点。" : "Continue into its public profile, family, and places."}</p>
                    <ArrowRight />
                  </Link>
                ))}
                {!atlasPreview.length ? <p>{zh ? "当前 V2 预览数据未连接。" : "Current V2 preview data is not connected."}</p> : null}
              </div>
            </div>

            <div className={styles.memoryCard}>
              <img src={fanV08VisualFixtures[5].image} alt="" />
              <div>
                <span>{zh ? "我的熊猫" : "My Pandas"}</span>
                <h3>{zh ? "把喜欢过、见过、去过的熊猫留下来。" : "Keep the pandas you loved, saw, and visited."}</h3>
                <p>{zh ? "关注之后，故事可以继续。" : "Follow them and the story can continue."}</p>
                <Link href={route(`/${locale}/my-pandas`)}>{zh ? "打开我的熊猫" : "Open My Pandas"}<ArrowRight /></Link>
              </div>
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <div><strong>吱熊猫 ZhiPanda</strong><span>{zh ? "给熊猫爱好者的熊猫世界。" : "A panda world for panda fans."}</span></div>
          <nav>
            <Link href={route(`/${locale}/contribute`)}>{zh ? "纠错与贡献" : "Contribute"}</Link>
            <Link href={route(`/${locale}/pandas`)}>{zh ? "数据来源在档案页继续查看" : "Sources remain available on profiles"}</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
