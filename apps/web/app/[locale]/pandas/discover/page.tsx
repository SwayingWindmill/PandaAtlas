import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, Grid3X3, MousePointer2 } from "lucide-react";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import { CircularGallery, type GalleryItem } from "@/components/ui/circular-gallery";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale, type PublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";
import type { PandaDetail, PublicPandaMediaAsset } from "@/lib/types";

interface PandaDiscoveryPageProps {
  params: Promise<{ locale: string }>;
}

const preferredPandas = [
  "lun-lun",
  "yang-yang",
  "ya-lun",
  "xi-lun",
  "mei-xiang",
  "tian-tian",
  "bao-bao",
  "bei-bei",
  "xiao-qi-ji",
  "xiang-xiang",
  "xiao-xiao",
  "lei-lei",
  "shin-shin",
  "ri-ri",
] as const;

const copy = {
  zh: {
    title: "熊猫星球 | 吱熊猫",
    description: "通过沉浸式环形画廊认识大熊猫，滚动浏览并进入每一只熊猫的公开资料。",
    eyebrow: "吱熊猫 · 沉浸式发现",
    heading: "转动熊猫星球",
    body: "向下滚动，让熊猫从你身边经过。选择一张照片，继续认识它的家族、生活地点和故事。",
    back: "返回熊猫图鉴",
    list: "查看全部熊猫",
    scroll: "滚动旋转",
    keyboard: "也可以使用左右方向键",
    credit: "图片",
    region: "可滚动旋转的熊猫画廊",
    endingEyebrow: "不想转动？",
    endingTitle: "用熟悉的方式继续寻找熊猫。",
    endingBody: "熊猫图鉴保留完整搜索、筛选和分页，画廊只是另一种更轻松的发现入口。",
    endingAction: "打开熊猫图鉴",
  },
  en: {
    title: "Panda planet | ZhiPanda",
    description: "Meet giant pandas through an immersive circular gallery, then open each panda's published profile.",
    eyebrow: "ZhiPanda · Immersive discovery",
    heading: "Turn the panda planet",
    body: "Scroll to bring pandas around you. Choose a photograph to continue into a panda's family, places, and story.",
    back: "Back to panda guide",
    list: "View all pandas",
    scroll: "Scroll to rotate",
    keyboard: "Left and right arrow keys also work",
    credit: "Photo",
    region: "Scrollable circular panda gallery",
    endingEyebrow: "Prefer a familiar view?",
    endingTitle: "Keep finding pandas with search and filters.",
    endingBody: "The panda guide retains complete search, filtering, and pagination. This gallery is simply another way to discover.",
    endingAction: "Open panda guide",
  },
} as const;

function imageFor(panda: PandaDetail): { url: string; asset: PublicPandaMediaAsset | null } | null {
  const available = panda.media.filter((asset) => asset.status === "available");
  const coverAsset = available.find((asset) =>
    asset.url === panda.cover_image_url
    || asset.derivatives.some((derivative) => derivative.url === panda.cover_image_url),
  ) ?? null;
  const asset = coverAsset ?? available[0] ?? null;
  const derivative = asset?.derivatives
    .filter((item) => item.width >= 800)
    .sort((left, right) => right.width - left.width)[0]
    ?? asset?.derivatives[0]
    ?? null;
  const url = panda.cover_image_url ?? derivative?.url ?? asset?.url ?? null;
  return url ? { url, asset } : null;
}

function localizedAlt(panda: PandaDetail, asset: PublicPandaMediaAsset | null, locale: PublicLocale): string {
  const reviewed = locale === "zh" ? asset?.alt_zh : asset?.alt_en;
  if (reviewed) return reviewed;
  return locale === "zh" ? `${panda.name_zh}的公开照片` : `Published photograph of ${panda.name_en ?? panda.name_zh}`;
}

function subtitleFor(panda: PandaDetail, locale: PublicLocale): string {
  const alternateName = locale === "zh" ? panda.name_en : panda.name_zh;
  const birthYear = panda.birth_date?.slice(0, 4) ?? null;
  const details = [alternateName, birthYear, panda.current_location].filter(Boolean);
  return details.join(" · ");
}

function buildGalleryItems(pandas: PandaDetail[], locale: PublicLocale): GalleryItem[] {
  const bySlug = new Map(pandas.map((panda) => [panda.slug, panda]));
  const ordered = [
    ...preferredPandas.flatMap((slug) => {
      const panda = bySlug.get(slug);
      return panda ? [panda] : [];
    }),
    ...pandas,
  ];
  const seen = new Set<string>();

  return ordered.flatMap((panda) => {
    if (seen.has(panda.id)) return [];
    seen.add(panda.id);
    const image = imageFor(panda);
    if (!image) return [];

    const credit = image.asset?.credit
      ?? image.asset?.photographer
      ?? (locale === "zh" ? "公开媒体资料" : "Published media release");

    return [{
      common: locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh,
      binomial: subtitleFor(panda, locale),
      href: `/${locale}/pandas/${panda.slug}`,
      photo: {
        url: image.url,
        text: localizedAlt(panda, image.asset, locale),
        by: credit,
      },
    }];
  }).slice(0, 10);
}

export async function generateMetadata({ params }: PandaDiscoveryPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/pandas/discover",
  });
}

export default async function PandaDiscoveryPage({ params }: PandaDiscoveryPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();
  const items = buildGalleryItems(envelope.data.pandas, locale);
  const t = copy[locale];
  const alternateLocale = locale === "zh" ? "en" : "zh";

  return (
    <>
      <GlobalNavigation
        locale={locale}
        active="atlas"
        alternatePath={`/${alternateLocale}/pandas/discover`}
      />
      <main id="main-content" className="bg-[#07120d] text-white" data-testid="panda-discovery-page">
        <section className="relative h-[320vh] min-h-[1800px]" aria-labelledby="panda-discovery-heading">
          <div className="sticky top-0 h-screen overflow-hidden bg-[#07120d]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(105,180,128,0.22),transparent_34%),radial-gradient(circle_at_15%_15%,rgba(244,218,102,0.12),transparent_22%),linear-gradient(180deg,#0d2117_0%,#07120d_65%,#030906_100%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-[1500px] items-start justify-between gap-8 px-5 pt-7 sm:px-10 sm:pt-10 lg:px-14">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9e7d9]">{t.eyebrow}</p>
                <h1 id="panda-discovery-heading" className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-6xl lg:text-7xl">
                  {t.heading}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">{t.body}</p>
              </div>
              <Link
                href={`/${locale}/pandas` as Route}
                className="pointer-events-auto hidden shrink-0 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white hover:text-black md:inline-flex"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t.back}
              </Link>
            </div>

            <div className="absolute inset-0 pt-24 sm:pt-28">
              <CircularGallery
                items={items}
                radius={500}
                autoRotateSpeed={0.012}
                creditLabel={t.credit}
                regionLabel={t.region}
              />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[1500px] items-end justify-between gap-5 px-5 pb-7 sm:px-10 sm:pb-10 lg:px-14">
              <div className="flex items-center gap-3 rounded-full border border-white/20 bg-black/25 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-md">
                <ArrowDown className="size-4" aria-hidden="true" />
                <span>{t.scroll}</span>
              </div>
              <div className="hidden items-center gap-2 text-xs font-medium text-white/55 sm:flex">
                <MousePointer2 className="size-4" aria-hidden="true" />
                {t.keyboard}
              </div>
              <Link
                href={`/${locale}/pandas` as Route}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-[#f1dc76] md:hidden"
              >
                <Grid3X3 className="size-4" aria-hidden="true" />
                {t.list}
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-white/12 bg-[#f3f0e7] px-5 py-24 text-[#101611] sm:px-10 lg:px-14 lg:py-32">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#496153]">{t.endingEyebrow}</p>
              <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.055em] sm:text-6xl">{t.endingTitle}</h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#526057]">{t.endingBody}</p>
            </div>
            <Link
              href={`/${locale}/pandas` as Route}
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#101611] px-6 py-3 font-bold text-white transition hover:bg-[#315d42]"
            >
              {t.endingAction}
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
