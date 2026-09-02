import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Heart, Search } from "lucide-react";

import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import type { PandaDetail, PublicPandaMediaAsset } from "@/lib/types";

import homeStyles from "../prototype.module.css";
import { fanV08VisualFixtures } from "../visual-fixtures";
import { DirectoryExplorer, type DirectoryPanda } from "./directory-explorer";
import styles from "./directory.module.css";
import { loadFanV08ResearchCatalog, type ResearchCatalogPanda } from "./research-catalog";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export const metadata: Metadata = {
  title: "ZhiPanda Fan V8 Panda Directory Prototype",
  description: "Fan-first editorial panda directory design prototype.",
  robots: { index: false, follow: false },
};

function route(value: string): Route {
  return value as Route;
}

function localizedName(panda: PandaDetail, locale: "zh" | "en"): string {
  return locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
}

function alternateName(panda: PandaDetail, locale: "zh" | "en"): string | null {
  const value = locale === "zh" ? panda.name_en : panda.name_zh;
  return value && value !== localizedName(panda, locale) ? value : null;
}

function mediaFor(panda: PandaDetail): PublicPandaMediaAsset | null {
  return panda.media.find((asset) => asset.url && asset.url === panda.cover_image_url)
    ?? panda.media.find((asset) => asset.status === "available" && Boolean(asset.url))
    ?? null;
}

function serializePublishedPanda(panda: PandaDetail, locale: "zh" | "en"): DirectoryPanda {
  const fixture = fanV08VisualFixtures.find((item) => item.slug === panda.slug) ?? null;
  const media = mediaFor(panda);
  const image = panda.cover_image_url ?? media?.url ?? fixture?.image ?? null;
  const name = localizedName(panda, locale);
  const mediaAlt = locale === "zh" ? media?.alt_zh : media?.alt_en;
  const location = panda.current_place?.coarse_location ?? panda.current_location;

  return {
    id: panda.id,
    slug: panda.slug,
    name,
    altName: alternateName(panda, locale),
    gender: panda.gender,
    status: panda.status,
    birthYear: panda.birth_date?.slice(0, 4) ?? null,
    location,
    image,
    imageAlt: mediaAlt ?? (locale === "zh" ? `${name}的大熊猫照片` : `Photograph of giant panda ${name}`),
    credit: panda.cover_image_url || media?.url ? media?.credit ?? null : fixture?.credit ?? null,
    rights: panda.cover_image_url || media?.url ? media?.rights ?? null : fixture?.rights ?? null,
    published: true,
  };
}

function researchName(panda: ResearchCatalogPanda, locale: "zh" | "en"): string {
  if (locale === "zh") return panda.name_zh || panda.name_en || panda.label;
  return panda.name_en || panda.name_zh || panda.label;
}

function serializeResearchPanda(
  panda: ResearchCatalogPanda,
  locale: "zh" | "en",
  published: DirectoryPanda | null,
): DirectoryPanda {
  if (published) {
    const researchMedia = panda.media;
    return {
      ...published,
      image: published.image ?? researchMedia?.url ?? null,
      imageAlt: published.image
        ? published.imageAlt
        : locale === "zh"
          ? `${published.name}的研究库确认个体照片`
          : `Research-vault confirmed individual photograph of ${published.name}`,
      credit: published.image ? published.credit : researchMedia?.credit ?? null,
      rights: published.image ? published.rights : researchMedia?.rights ?? null,
    };
  }

  const fixture = fanV08VisualFixtures.find((item) => item.slug === panda.slug) ?? null;
  const name = researchName(panda, locale);
  const alternate = locale === "zh" ? panda.name_en : panda.name_zh;
  const image = panda.media?.url ?? fixture?.image ?? null;

  return {
    id: panda.id,
    slug: panda.slug,
    name,
    altName: alternate && alternate !== name ? alternate : null,
    gender: panda.gender,
    status: panda.status,
    birthYear: panda.birth_year,
    location: null,
    image,
    imageAlt: locale === "zh" ? `${name}的研究库确认个体照片` : `Research-vault confirmed individual photograph of ${name}`,
    credit: panda.media?.credit ?? fixture?.credit ?? null,
    rights: panda.media?.rights ?? fixture?.rights ?? null,
    published: false,
  };
}

export default async function FanV08PandaDirectoryPrototype({ params, searchParams }: Props) {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const zh = locale === "zh";
  const [atlas, researchCatalog] = await Promise.all([
    loadV2PublicAtlasDataset(locale),
    loadFanV08ResearchCatalog(),
  ]);
  if (!atlas) notFound();

  const publishedPandas = atlas.data.pandas.map((panda) => serializePublishedPanda(panda, locale));
  const publishedBySlug = new Map(publishedPandas.map((panda) => [panda.slug, panda]));

  let pandas: DirectoryPanda[];
  if (researchCatalog) {
    const researchPandas = researchCatalog.pandas.map((panda) =>
      serializeResearchPanda(panda, locale, publishedBySlug.get(panda.slug) ?? null),
    );
    const researchSlugs = new Set(researchPandas.map((panda) => panda.slug));
    pandas = [
      ...researchPandas,
      ...publishedPandas.filter((panda) => !researchSlugs.has(panda.slug)),
    ];
  } else {
    pandas = publishedPandas;
  }

  const fixtureOrder = new Map(fanV08VisualFixtures.map((fixture, index) => [fixture.slug, index]));
  pandas.sort((left, right) => {
    const leftFixture = fixtureOrder.get(left.slug);
    const rightFixture = fixtureOrder.get(right.slug);
    if (leftFixture !== undefined || rightFixture !== undefined) {
      return (leftFixture ?? Number.MAX_SAFE_INTEGER) - (rightFixture ?? Number.MAX_SAFE_INTEGER);
    }
    if (Boolean(left.image) !== Boolean(right.image)) return left.image ? -1 : 1;
    return left.name.localeCompare(right.name, locale);
  });

  const otherLocale = zh ? "en" : "zh";
  const initialQuery = one(rawSearch.q);
  const researchMode = Boolean(researchCatalog);
  const publishedCount = publishedPandas.length;
  const photoCount = researchCatalog?.summary.subjects_with_confirmed_media
    ?? pandas.filter((panda) => Boolean(panda.image)).length;
  const noPhotoCount = researchCatalog?.summary.subjects_without_confirmed_media
    ?? pandas.filter((panda) => !panda.image).length;

  return (
    <div className={homeStyles.page} data-testid="fan-v08-directory">
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
            <a className={homeStyles.roundButton} href="#directory-search" aria-label={zh ? "搜索熊猫" : "Search pandas"}><Search /></a>
            <Link className={homeStyles.roundButton} href={route(`/${locale}/my-pandas`)} aria-label={zh ? "我的熊猫" : "My Pandas"}><Heart /></Link>
            <Link className={homeStyles.lang} href={route(`/${otherLocale}/prototype/fan-v08/pandas`)}>{zh ? "EN" : "中"}</Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.directoryMasthead} aria-labelledby="v8-directory-title">
          <div className={styles.mastheadShell}>
            <div className={styles.mastheadTop}>
              <div className={styles.mastheadCopy}>
                <h1 id="v8-directory-title">{zh ? "熊猫图鉴" : "Panda directory"}</h1>
                <p>{zh ? "用照片和名字快速浏览每一只熊猫。搜索、筛选和状态信息都服务于辨认，不抢走主体。" : "Browse every panda through thumbnail and name. Search, filters, and status information support recognition without competing with identity."}</p>
              </div>
              <div className={styles.datasetCount} data-testid={researchMode ? "fan-v08-research-count" : undefined}>
                <strong>{pandas.length}</strong>
                <span>
                  {researchMode
                    ? zh
                      ? `${photoCount} 有确认个体影像 · ${noPhotoCount} 暂无确认个体影像 · 正式发布 ${publishedCount}`
                      : `${photoCount} with confirmed individual media · ${noPhotoCount} without confirmed media · ${publishedCount} published`
                    : zh
                      ? "当前公开版本中的熊猫"
                      : "pandas in the current public release"}
                </span>
              </div>
            </div>
            <span className={styles.prototypeNote}>
              {researchMode
                ? zh ? "V8.3 列表原型 · 本地研究数据仅用于规模与版式评审，不代表公开发布。" : "V8.3 list prototype · local research data is for scale and layout review only, not publication."
                : zh ? "V8.3 熊猫列表原型" : "V8.3 panda list prototype"}
            </span>
          </div>
        </section>

        <DirectoryExplorer locale={locale} pandas={pandas} initialQuery={initialQuery} />

        <footer className={homeStyles.footer}>
          <div><strong>吱熊猫 ZhiPanda</strong><span>{zh ? "给熊猫爱好者的熊猫世界。" : "A panda world for panda fans."}</span></div>
          <nav>
            <Link href={route(`/${locale}/prototype/fan-v08`)}>{zh ? "V8 首页" : "V8 Home"}</Link>
            <Link href={route(`/${locale}/pandas`)}>{zh ? "正式熊猫图鉴与完整筛选" : "Production directory and full filters"}</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
