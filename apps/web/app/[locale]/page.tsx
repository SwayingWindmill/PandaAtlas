import type { Metadata } from "next";
import { notFound } from "next/navigation";

import FooterMinimal from "@/components/blocks/marketing/footers/minimal";
import type { PandaHeroRailItem } from "@/components/blocks/zhipanda/panda-hero-rail";
import type { ArchiveSearchResult } from "@/components/command-menu-04";
import { Navbar1, type NavbarFeature } from "@/components/navbar-1";
import HomeCommunity from "@/features/home/home-community";
import homeStyles from "@/features/home/home-community.module.css";
import { buildHomeV09ViewModel, homeV09PandaIds, withHomeV09Media } from "@/features/home/home-v09-view-model";
import { loadV2PandaCovers, loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LocalizedHomePageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "吱熊猫｜认识每一只熊猫",
    description: "从名字、家人、照片和生活过的地方，走进真实的熊猫世界。",
  },
  en: {
    title: "ZhiPanda | Meet every panda",
    description: "Enter the real panda world through names, families, photographs, and places.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedHomePageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({ locale, title: t.title, description: t.description });
}

export default async function LocalizedHomePage({ params }: LocalizedHomePageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();

  const baseModel = buildHomeV09ViewModel(envelope.data, locale);
  const model = withHomeV09Media(baseModel, await loadV2PandaCovers(homeV09PandaIds(baseModel)), locale);
  const zh = locale === "zh";

  const pandaRailItems: PandaHeroRailItem[] = model.explore.pandas.flatMap((panda) => {
    if (!panda.media) return [];
    return [{
      id: panda.id,
      href: panda.href,
      imageSrc: panda.media.src,
      imageSources: [panda.media.src],
      imageAlt: panda.media.alt,
      name: panda.name,
      meta: [panda.birthYear, panda.placeLabel].filter(Boolean).join(" · ")
        || (zh ? "认识这只熊猫" : "Meet this panda"),
    }];
  });

  const navFeatures: NavbarFeature[] = pandaRailItems.slice(0, 4).map((item) => ({
    href: item.href,
    imageSrc: item.imageSrc,
    name: item.name,
    meta: item.meta,
  }));

  const searchResults: ArchiveSearchResult[] = [
    ...envelope.data.pandas.map((panda) => {
      const name = zh ? panda.name_zh : panda.name_en ?? panda.name_zh;
      const alternateName = zh ? panda.name_en : panda.name_zh;
      const place = panda.current_place?.coarse_location ?? panda.current_location;
      return {
        id: `panda-${panda.id}`,
        kind: "panda" as const,
        title: name,
        snippet: [alternateName !== name ? alternateName : null, place].filter(Boolean).join(" · ")
          || (zh ? "熊猫主页" : "Panda profile"),
        meta: panda.birth_date?.slice(0, 4) ?? null,
        href: `/${locale}/pandas/${panda.slug}`,
      };
    }),
    ...(model.family ? [{
      id: `family-${model.family.focus.id}`,
      kind: "family" as const,
      title: model.family.title,
      snippet: model.family.body,
      meta: zh ? `${model.family.members.length + 1} 个成员` : `${model.family.members.length + 1} members`,
      href: model.family.href,
    }] : []),
    ...model.places.map((place) => ({
      id: `place-${place.id}`,
      kind: "place" as const,
      title: place.name,
      snippet: zh
        ? `有 ${place.pandaCount} 只已公开熊猫与这里有关`
        : `Connected with ${place.pandaCount} published pandas`,
      meta: null,
      href: place.href,
    })),
  ];

  return (
    <div className={homeStyles.pageTheme} data-testid="localized-home-page">
      <Navbar1
        locale={locale}
        searchResults={searchResults}
        featuredPandas={navFeatures}
        immersive
      />

      <main id="main-content">
        <HomeCommunity
          locale={locale}
          model={model}
          pandaRailItems={pandaRailItems}
        />
      </main>

      <FooterMinimal locale={locale} />
    </div>
  );
}
