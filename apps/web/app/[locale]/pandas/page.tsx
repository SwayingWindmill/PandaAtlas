import type { Metadata } from "next";
import { notFound } from "next/navigation";

import FooterMinimal from "@/components/blocks/marketing/footers/minimal";
import type { ArchiveSearchResult } from "@/components/command-menu-04";
import { Navbar1, type NavbarFeature } from "@/components/navbar-1";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";
import type { PandaDetail, PublicPandaMediaAsset } from "@/lib/types";

import { DirectoryExplorer, type DirectoryPanda } from "@/features/panda-directory/directory-explorer";
import { DirectoryMasthead } from "@/features/panda-directory/directory-masthead";
import styles from "@/features/panda-directory/directory.module.css";

interface LocalizedPandasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = {
  zh: {
    title: "熊猫图鉴 | 吱熊猫",
    description: "从照片、名字、家族与生活过的地方认识每一只已公开的大熊猫。",
  },
  en: {
    title: "Panda directory | ZhiPanda",
    description: "Meet published giant pandas through their faces, names, families, and the places they have lived.",
  },
} as const;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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
  const media = mediaFor(panda);
  const image = panda.cover_image_url ?? media?.url ?? null;
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
    imageCandidates: image ? [image] : [],
    imageAlt: mediaAlt ?? (locale === "zh" ? `${name}的大熊猫照片` : `Photograph of giant panda ${name}`),
    credit: media?.credit ?? null,
    rights: media?.rights ?? null,
    published: true,
  };
}

function heroFor(pandas: PandaDetail[], locale: "zh" | "en") {
  const panda = pandas.find((item) => Boolean(item.cover_image_url))
    ?? pandas.find((item) => item.media.some((media) => media.status === "available" && Boolean(media.url)))
    ?? null;
  if (!panda) return null;

  const media = mediaFor(panda);
  const image = panda.cover_image_url ?? media?.url ?? null;
  if (!image) return null;

  const name = localizedName(panda, locale);
  return {
    image,
    alt: locale === "zh" ? `${name}的大熊猫照片` : `Photograph of giant panda ${name}`,
    credit: media?.credit ?? null,
    rights: media?.rights ?? null,
  };
}

export async function generateMetadata({ params }: LocalizedPandasPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({ locale, title: t.title, description: t.description, path: "/pandas" });
}

export default async function LocalizedPandasPage({ params, searchParams }: LocalizedPandasPageProps) {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();

  const pandas = envelope.data.pandas
    .map((panda) => serializePublishedPanda(panda, locale))
    .sort((left, right) => {
      if (Boolean(left.image) !== Boolean(right.image)) return left.image ? -1 : 1;
      return left.name.localeCompare(right.name, locale === "zh" ? "zh-CN" : "en");
    });
  const initialQuery = one(rawSearch.q);
  const otherLocale = locale === "zh" ? "en" : "zh";
  const languageHref = initialQuery
    ? `/${otherLocale}/pandas?q=${encodeURIComponent(initialQuery)}`
    : `/${otherLocale}/pandas`;
  const navSearchResults: ArchiveSearchResult[] = pandas.map((panda) => ({
    id: `panda-${panda.id}`,
    kind: "panda" as const,
    title: panda.name,
    snippet: [panda.altName, panda.location].filter(Boolean).join(" · ")
      || (locale === "zh" ? "熊猫主页" : "Panda profile"),
    meta: panda.birthYear,
    href: `/${locale}/pandas/${panda.slug}`,
  }));
  const navFeatures: NavbarFeature[] = pandas
    .filter((panda): panda is DirectoryPanda & { image: string } => Boolean(panda.image))
    .slice(0, 4)
    .map((panda) => ({
      href: `/${locale}/pandas/${panda.slug}`,
      imageSrc: panda.image,
      name: panda.name,
      meta: [panda.birthYear, panda.location].filter(Boolean).join(" · ")
        || (locale === "zh" ? "认识这只熊猫" : "Meet this panda"),
    }));

  return (
    <div className={styles.directoryPage} data-testid="localized-pandas-page">
      <Navbar1
        locale={locale}
        searchResults={navSearchResults}
        featuredPandas={navFeatures}
        languageHref={languageHref}
        immersive
      />

      <main id="main-content">
        <DirectoryMasthead
          locale={locale}
          count={pandas.length}
          hero={heroFor(envelope.data.pandas, locale)}
        />

        <DirectoryExplorer locale={locale} pandas={pandas} initialQuery={initialQuery} />

        <div className={styles.listShell}>
          <PublicDeliveryNotice
            locale={locale}
            release={envelope.release}
            delivery={envelope.delivery}
            coverage={envelope.coverage}
            localeDelivery={envelope.locale}
          />
        </div>

      </main>

      <FooterMinimal locale={locale} />
    </div>
  );
}
