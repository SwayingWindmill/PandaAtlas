import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import type { PandaDetail, PublicPandaMediaAsset } from "@/lib/types";

import homeStyles from "../prototype.module.css";
import { PrototypeFooter } from "../prototype-footer";
import { PrototypeHeader } from "../prototype-header";
import { fanV08VisualFixtures } from "../visual-fixtures";
import { DirectoryExplorer, type DirectoryPanda } from "./directory-explorer";
import { DirectoryMasthead } from "./directory-masthead";
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
  description: "Fan-first photographic panda directory design prototype.",
  robots: { index: false, follow: false },
};

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
  const name = fixture
    ? locale === "zh" ? fixture.zh : fixture.en
    : localizedName(panda, locale);
  const fixtureAlternate = fixture
    ? locale === "zh" ? fixture.en : fixture.zh
    : null;
  const mediaAlt = locale === "zh" ? media?.alt_zh : media?.alt_en;
  const location = panda.current_place?.coarse_location ?? panda.current_location;

  const imageCandidates = Array.from(new Set([
    panda.cover_image_url,
    media?.url,
    fixture?.image,
  ].filter((value): value is string => Boolean(value))));

  return {
    id: panda.id,
    slug: panda.slug,
    name,
    altName: fixtureAlternate && fixtureAlternate !== name
      ? fixtureAlternate
      : alternateName(panda, locale),
    gender: panda.gender,
    status: panda.status,
    birthYear: panda.birth_date?.slice(0, 4) ?? null,
    location,
    image,
    imageCandidates,
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
    const imageCandidates = Array.from(new Set([
      ...(published.imageCandidates ?? []),
      researchMedia?.url,
    ].filter((value): value is string => Boolean(value))));

    return {
      ...published,
      image: published.image ?? researchMedia?.url ?? null,
      imageCandidates,
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
  const name = fixture
    ? locale === "zh" ? fixture.zh : fixture.en
    : researchName(panda, locale);
  const alternate = fixture
    ? locale === "zh" ? fixture.en : fixture.zh
    : locale === "zh" ? panda.name_en : panda.name_zh;
  const image = panda.media?.url ?? fixture?.image ?? null;

  const imageCandidates = Array.from(new Set([
    panda.media?.url,
    fixture?.image,
  ].filter((value): value is string => Boolean(value))));

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
    imageCandidates,
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
    loadV2PublicAtlasDataset(locale).catch(() => null),
    loadFanV08ResearchCatalog(true),
  ]);
  if (!atlas && !researchCatalog) notFound();

  const publishedPandas = atlas?.data.pandas.map((panda) => serializePublishedPanda(panda, locale)) ?? [];
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
  const heroFixture = fanV08VisualFixtures.find((item) => item.slug === "bao-li") ?? fanV08VisualFixtures[0] ?? null;

  return (
    <div className={`${homeStyles.page} ${styles.directoryPage}`} data-testid="fan-v08-directory">
      <PrototypeHeader
        locale={locale}
        active="pandas"
        searchHref="#directory-search"
        languageHref={`/${otherLocale}/prototype/fan-v08/pandas`}
      />

      <main>
        <DirectoryMasthead
          locale={locale}
          count={pandas.length}
          researchMode={researchMode}
          hero={heroFixture ? {
            image: heroFixture.image,
            alt: locale === "zh" ? `${heroFixture.zh}的大熊猫照片` : `Photograph of giant panda ${heroFixture.en}`,
            credit: heroFixture.credit,
            rights: heroFixture.rights,
          } : null}
        />

        <DirectoryExplorer locale={locale} pandas={pandas} initialQuery={initialQuery} />

        <PrototypeFooter locale={locale} directory />
      </main>
    </div>
  );
}
