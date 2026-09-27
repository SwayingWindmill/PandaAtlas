import type { Metadata } from "next";
import { notFound } from "next/navigation";

import FooterMinimal from "@/components/blocks/marketing/footers/minimal";
import type { PandaHeroRailItem } from "@/components/blocks/zhipanda/panda-hero-rail";
import type { ArchiveSearchResult } from "@/components/command-menu-04";
import { Navbar1, type NavbarFeature } from "@/components/navbar-1";
import { fanV08VisualFixtures } from "@/app/[locale]/prototype/fan-v08/visual-fixtures";
import HomeCommunity from "@/features/home/home-community";
import homeStyles from "@/features/home/home-community.module.css";
import { buildHomeV09ReviewModel } from "@/features/home/home-v09-review-model";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

interface Props {
  params: Promise<{ locale: string }>;
}

function collectionSearchCopy(id: string, zh: boolean) {
  const copy = {
    "family-linked": zh
      ? ["美香一家", "沿家人关系继续认识这一家熊猫。"]
      : ["The Mei Xiang family", "Keep exploring through family connections."],
    "with-media": zh
      ? ["从照片开始", "先看见熊猫，再进入它们各自的故事。"]
      : ["Start with photos", "See the pandas first, then enter their stories."],
    "multi-place": zh
      ? ["卧龙神树坪的熊猫", "从一个地方认识曾在这里生活的熊猫。"]
      : ["Pandas of Wolong Shenshuping", "Discover pandas through one shared place."],
    "recently-updated": zh
      ? ["最近有新内容", "看看哪些熊猫主页刚刚补充了新的信息。"]
      : ["Recently updated", "See which panda profiles have new information."],
  } as const;

  return copy[id as keyof typeof copy] ?? null;
}

export const metadata: Metadata = {
  title: "ZhiPanda Home Prototype",
  description: "A panda-first home for fans to discover pandas, families, places, and recent moments.",
  robots: { index: false, follow: false },
};

const preferredRailSlugs = [
  "he-hua",
  "fu-bao",
  "mei-xiang",
  "meng-lan",
  "xiang-xiang",
  "xiao-qi-ji",
  "bao-bao",
  "bei-bei",
  "ya-lun",
  "xi-lun",
  "shin-shin",
  "ri-ri",
  "xiao-xiao",
  "lei-lei",
  "tian-tian",
  "yang-guang",
  "lun-lun",
  "yang-yang",
] as const;

function buildPandaRailItems(locale: "zh" | "en"): PandaHeroRailItem[] {
  const release = loadPublishedAtlasDataset(locale);
  const fixtureBySlug = new Map(fanV08VisualFixtures.map((fixture) => [fixture.slug, fixture] as const));
  const pandaBySlug = new Map(release.data.pandas.map((panda) => [panda.slug, panda] as const));
  const ordered = [
    ...preferredRailSlugs.flatMap((slug) => {
      const panda = pandaBySlug.get(slug);
      return panda ? [panda] : [];
    }),
    ...release.data.pandas,
  ];
  const seen = new Set<string>();

  return ordered.flatMap((panda) => {
    if (seen.has(panda.id)) return [];
    const fixture = fixtureBySlug.get(panda.slug);
    const imageSources = [...new Set([
      fixture?.image,
      panda.cover_image_url,
      ...panda.media
        .filter((asset) => asset.status === "available")
        .flatMap((asset) => [
          asset.signed_url,
          ...asset.derivatives.map((derivative) => derivative.url),
          asset.url,
        ]),
    ].filter((value): value is string => Boolean(value)))];
    const imageSrc = imageSources[0] ?? null;
    if (!imageSrc) return [];

    seen.add(panda.id);
    const name = locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
    const media = panda.media.find((asset) =>
      asset.url === imageSrc
      || asset.signed_url === imageSrc
      || asset.derivatives.some((derivative) => derivative.url === imageSrc),
    );
    const imageAlt = locale === "zh"
      ? media?.alt_zh ?? media?.alt_en ?? fixture?.zh ?? panda.name_zh
      : media?.alt_en ?? media?.alt_zh ?? fixture?.en ?? panda.name_en ?? panda.name_zh;
    const meta = [
      panda.birth_date?.slice(0, 4),
      panda.current_location,
    ].filter(Boolean).join(" · ");

    return [{
      id: panda.id,
      href: `/${locale}/pandas/${panda.slug}`,
      imageSrc,
      imageSources,
      imageAlt,
      name,
      meta: meta || (locale === "zh" ? "认识这只熊猫" : "Meet this panda"),
    }];
  }).slice(0, 20);
}

export default async function FanV08HomePrototype({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const model = buildHomeV09ReviewModel(locale);
  const pandaRailItems = buildPandaRailItems(locale);
  const navFeatures: NavbarFeature[] = pandaRailItems.slice(0, 4).map((item) => ({
    href: item.href,
    imageSrc: item.imageSrc,
    name: item.name,
    meta: item.meta,
  }));
  const zh = locale === "zh";

  const searchResults: ArchiveSearchResult[] = [
    ...model.explore.pandas.map((panda) => ({
      id: `panda-${panda.id}`,
      kind: "panda" as const,
      title: panda.name,
      snippet: [panda.alternateName, panda.placeLabel].filter(Boolean).join(" · ")
        || (zh ? "熊猫主页" : "Panda profile"),
      meta: panda.birthYear,
      href: panda.href,
    })),
    ...(model.family ? [{
      id: `family-${model.family.focus.id}`,
      kind: "family" as const,
      title: zh ? "美香一家" : "The Mei Xiang family",
      snippet: zh ? "沿家人关系继续认识这一家熊猫。" : "Keep exploring through confirmed family connections.",
      meta: zh ? `${model.family.members.length + 1} 个成员` : `${model.family.members.length + 1} members`,
      href: model.family.href,
    }] : []),
    ...model.places.map((place) => ({
      id: `place-${place.id}`,
      kind: "place" as const,
      title: place.name,
      snippet: zh
        ? `有 ${place.pandaCount} 只熊猫曾与这里有关`
        : `Connected with ${place.pandaCount} pandas`,
      meta: null,
      href: place.href,
    })),
    ...model.collections.map((collection) => {
      const fanCopy = collectionSearchCopy(collection.id, zh);
      return {
        id: `collection-${collection.id}`,
        kind: "collection" as const,
        title: fanCopy?.[0] ?? collection.title,
        snippet: fanCopy?.[1] ?? collection.description,
        meta: zh ? `${collection.pandaIds.length} 只熊猫` : `${collection.pandaIds.length} pandas`,
        href: collection.href,
      };
    }),
  ];

  return (
    <div
      className={homeStyles.pageTheme}
      data-testid="fan-v08-prototype"
    >
      <Navbar1
        locale={locale}
        searchResults={searchResults}
        featuredPandas={navFeatures}
        immersive
      />

      <main>
        <HomeCommunity locale={locale} model={model} pandaRailItems={pandaRailItems} />
      </main>

      <FooterMinimal locale={locale} />
    </div>
  );
}
