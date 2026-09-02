/* eslint-disable @next/next/no-img-element */
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Heart, Search } from "lucide-react";

import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import type { PandaDetail } from "@/lib/types";

import homeStyles from "../../prototype.module.css";
import { loadFanV08ResearchCatalog } from "../research-catalog";
import styles from "./detail.module.css";
import { DetailEntrance, Reveal } from "./detail-motion";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

function route(value: string): Route {
  return value as Route;
}

function sexLabel(value: string | null | undefined, zh: boolean): string | null {
  if (value === "female") return zh ? "雌性" : "Female";
  if (value === "male") return zh ? "雄性" : "Male";
  return null;
}

function statusLabel(value: string | null | undefined, zh: boolean): string | null {
  if (value === "alive") return zh ? "在世" : "Alive";
  if (value === "deceased") return zh ? "已离世" : "Deceased";
  return null;
}

function compactDate(value: string, locale: "zh" | "en"): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function pandaName(panda: PandaDetail, locale: "zh" | "en"): string {
  return locale === "zh" ? panda.name_zh : panda.name_en || panda.name_zh;
}

function eventPlace(panda: PandaDetail["events"][number], locale: "zh" | "en"): string {
  const from = panda.from_coarse_location;
  const to = panda.to_coarse_location;
  if (from && to && from !== to) return `${from} → ${to}`;
  return to || from || (locale === "zh" ? "生活记录" : "Life event");
}

function uniqueMedia(items: PandaDetail["media"]): PandaDetail["media"] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export default async function FanV08PandaDetailPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";

  const [researchCatalog, atlas] = await Promise.all([
    loadFanV08ResearchCatalog(true),
    loadV2PublicAtlasDataset(locale).catch(() => null),
  ]);
  const researchPanda = researchCatalog?.pandas.find((panda) => panda.slug === slug) ?? null;
  const publicPanda = atlas?.data.pandas.find((panda) => panda.slug === slug) ?? null;
  if (!researchPanda && !publicPanda) notFound();

  const displayName = researchPanda
    ? (zh ? researchPanda.name_zh : researchPanda.name_en || researchPanda.name_zh)
    : pandaName(publicPanda!, locale);
  const alternateName = researchPanda
    ? (zh ? researchPanda.name_en : researchPanda.name_zh)
    : (zh ? publicPanda?.name_en : publicPanda?.name_zh);

  const birthYear = researchPanda?.birth_year ?? publicPanda?.birth_date?.slice(0, 4) ?? null;
  const sex = researchPanda?.gender ?? publicPanda?.gender ?? "unknown";
  const lifeStatus = researchPanda?.status ?? publicPanda?.status ?? "unknown";
  const place = publicPanda?.current_place?.coarse_location ?? publicPanda?.current_location ?? null;

  const publicMedia = publicPanda ? uniqueMedia(publicPanda.media.filter((item) => item.status === "available")) : [];
  const publicHero = publicMedia.find((item) => item.url)?.url ?? publicPanda?.cover_image_url ?? null;
  const image = researchPanda?.media?.url ?? publicHero;
  const heroAsset = publicMedia.find((item) => item.url === image);
  const imageCredit = researchPanda?.media?.credit ?? heroAsset?.credit ?? null;
  const imageRights = researchPanda?.media?.rights ?? heroAsset?.rights ?? null;

  const meta = [birthYear, sexLabel(sex, zh), statusLabel(lifeStatus, zh), place].filter(Boolean) as string[];
  const otherLocale = zh ? "en" : "zh";

  const publishedById = new Map((atlas?.data.pandas ?? []).map((panda) => [panda.id, panda]));
  const parentPandas = publicPanda
    ? [publicPanda.father_id, publicPanda.mother_id]
        .filter((id): id is string => Boolean(id))
        .map((id) => publishedById.get(id))
        .filter((panda): panda is PandaDetail => Boolean(panda))
    : [];
  const childPandas = publicPanda
    ? (atlas?.data.pandas ?? []).filter((panda) => panda.father_id === publicPanda.id || panda.mother_id === publicPanda.id)
    : [];
  const familyGroups = [
    { label: zh ? "父母" : "Parents", items: parentPandas },
    { label: zh ? "子女" : "Children", items: childPandas },
  ].filter((group) => group.items.length);

  const timeline = publicPanda
    ? [...publicPanda.events].sort((left, right) => left.event_date.localeCompare(right.event_date))
    : [];
  const footprint = publicPanda
    ? [...publicPanda.residencies].sort((left, right) => left.start_date.localeCompare(right.start_date))
    : [];
  const story = publicPanda?.localized_content.find((item) => item.locale === (zh ? "zh-CN" : "en"))?.summary
    ?? publicPanda?.intro
    ?? null;
  const mediaItems = publicMedia.slice(0, 6);
  const sources = publicPanda?.sources ?? [];

  return (
    <div className={homeStyles.page} data-testid="fan-v08-panda-detail">
      <DetailEntrance />
      <header className={homeStyles.header}>
        <div className={homeStyles.headerInner}>
          <Link className={homeStyles.brand} href={route(`/${locale}/prototype/fan-v08`)}>
            <span className={homeStyles.brandMark} aria-hidden="true" />
            <span>吱熊猫 ZhiPanda</span>
          </Link>
          <nav className={homeStyles.nav} aria-label={zh ? "V8 原型主导航" : "V8 prototype navigation"}>
            <Link aria-current="page" href={route(`/${locale}/prototype/fan-v08/pandas`)}>{zh ? "熊猫" : "Pandas"}</Link>
            <Link href={route(`/${locale}/families`)}>{zh ? "家族" : "Families"}</Link>
            <Link href={route(`/${locale}/map`)}>{zh ? "地图" : "Map"}</Link>
            <Link href={route(`/${locale}/moments`)}>{zh ? "动态" : "Moments"}</Link>
          </nav>
          <div className={homeStyles.headerActions}>
            <Link className={homeStyles.roundButton} href={route(`/${locale}/prototype/fan-v08/pandas`)} aria-label={zh ? "搜索熊猫" : "Search pandas"}><Search /></Link>
            <Link className={homeStyles.roundButton} href={route(`/${locale}/my-pandas`)} aria-label={zh ? "我的熊猫" : "My Pandas"}><Heart /></Link>
            <Link className={homeStyles.lang} href={route(`/${otherLocale}/prototype/fan-v08/pandas/${slug}`)}>{zh ? "EN" : "中"}</Link>
          </div>
        </div>
      </header>

      <main className={styles.detailMain}>
        <section className={styles.hero} aria-labelledby="panda-detail-name">
          <div className={styles.heroMedia} data-panda-detail-hero>
            {image ? (
              <img src={image} alt={zh ? `${displayName}的大熊猫肖像` : `Portrait of giant panda ${displayName}`} />
            ) : (
              <div className={styles.heroNoPhoto} aria-label={zh ? `${displayName}暂无确认个体照片` : `No confirmed individual photograph for ${displayName}`}>
                <span aria-hidden="true">{displayName.slice(0, 1)}</span>
              </div>
            )}
            {(imageCredit || imageRights) ? (
              <p className={styles.mediaCredit}>{[imageCredit, imageRights].filter(Boolean).join(" · ")}</p>
            ) : null}
          </div>

          <div className={styles.heroCopy}>
            <Reveal className={styles.heroCopyInner} delay={0.08}>
              <Link className={styles.backLink} href={route(`/${locale}/prototype/fan-v08/pandas`)}>
                <ArrowLeft aria-hidden="true" />{zh ? "熊猫图鉴" : "Panda directory"}
              </Link>
              <h1 id="panda-detail-name">{displayName}</h1>
              {alternateName ? <p className={styles.alternateName}>{alternateName}</p> : null}
              {meta.length ? (
                <ul className={styles.heroFacts} aria-label={zh ? "熊猫基本信息" : "Panda overview"}>
                  {meta.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
              {story ? <p className={styles.summary}>{story}</p> : null}
              <div className={styles.heroLinks}>
                <Link href={route(`/${locale}/families?view=lineage&focus=${slug}`)}>{zh ? "家族" : "Family"}<ArrowUpRight aria-hidden="true" /></Link>
                <Link href={route(`/${locale}/moments?panda=${slug}`)}>{zh ? "时光" : "Moments"}<ArrowUpRight aria-hidden="true" /></Link>
              </div>
            </Reveal>
          </div>
        </section>

        {story ? (
          <section className={styles.storySection}>
            <div className={styles.readingShell}>
              <h2>{zh ? "关于" : "About"} {displayName}</h2>
              <div className={styles.storyCopy}><p>{story}</p></div>
            </div>
          </section>
        ) : null}

        {timeline.length ? (
          <section className={styles.section} id="timeline">
            <div className={styles.wideShell}>
              <div className={styles.sectionHead}>
                <h2>{zh ? "一生的轨迹" : "Life journey"}</h2>
                <span>{timeline.length}</span>
              </div>
              <ol className={styles.timeline}>
                {timeline.map((item) => (
                  <li key={item.id}>
                    <time dateTime={item.event_date}>{compactDate(item.event_date, locale)}</time>
                    <div>
                      <strong>{eventPlace(item, locale)}</strong>
                      <span>{item.event_type.replaceAll("_", " ")}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {familyGroups.length ? (
          <section className={`${styles.section} ${styles.familySection}`} id="family">
            <div className={styles.wideShell}>
              <div className={styles.sectionHead}><h2>{zh ? "家族" : "Family"}</h2></div>
              <div className={styles.familyGrid}>
                {familyGroups.map((group) => (
                  <div key={group.label} className={styles.familyGroup}>
                    <h3>{group.label}</h3>
                    <ul>
                      {group.items.map((relation) => (
                        <li key={relation.id}>
                          <Link href={route(`/${locale}/prototype/fan-v08/pandas/${relation.slug}`)}>
                            <span>{pandaName(relation, locale)}</span><ArrowUpRight aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {footprint.length ? (
          <section className={styles.section} id="footprint">
            <div className={styles.wideShell}>
              <div className={styles.sectionHead}><h2>{zh ? "去过的地方" : "Places"}</h2></div>
              <ol className={styles.footprint}>
                {footprint.map((stop, index) => (
                  <li key={stop.id}>
                    <span className={styles.stopIndex}>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{stop.coarse_location || (zh ? "居住记录" : "Residency")}</strong>
                    <span>{compactDate(stop.start_date, locale)}{stop.end_date ? ` — ${compactDate(stop.end_date, locale)}` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {mediaItems.length > 1 ? (
          <section className={`${styles.section} ${styles.mediaSection}`} id="media">
            <div className={styles.wideShell}>
              <div className={styles.sectionHead}>
                <h2>{zh ? "影像" : "Images"}</h2>
                <span>{mediaItems.length}</span>
              </div>
              <div className={styles.mediaGrid}>
                {mediaItems.map((item, index) => (
                  <figure key={item.id} className={index === 0 ? styles.mediaLead : undefined}>
                    <img src={item.url!} alt={(zh ? item.alt_zh : item.alt_en) || displayName} loading="lazy" />
                    {(item.credit || item.rights) ? <figcaption>{[item.credit, item.rights].filter(Boolean).join(" · ")}</figcaption> : null}
                  </figure>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {sources.length ? (
          <section className={styles.sourcesSection} id="sources">
            <div className={styles.wideShell}>
              <h2>{zh ? "资料来源" : "Sources"}</h2>
              <ul>
                {sources.map((source) => (
                  <li key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      <span>{source.publisher}</span>
                      <strong>{source.title}</strong>
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </main>

      <footer className={homeStyles.footer}>
        <div><strong>吱熊猫 ZhiPanda</strong><span>{zh ? "给熊猫爱好者的熊猫世界。" : "A panda world for panda fans."}</span></div>
        <nav><Link href={route(`/${locale}/prototype/fan-v08/pandas`)}>{zh ? "熊猫图鉴" : "Panda directory"}</Link></nav>
      </footer>
    </div>
  );
}
