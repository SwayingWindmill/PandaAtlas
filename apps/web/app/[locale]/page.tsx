import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ImageData } from "@/components/ui/img-sphere";
import { EditorialHomePage } from "@/features/home/editorial-home-page";
import { buildEditorialHomeViewModel } from "@/features/home/editorial-home-view-model";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale, type PublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";
import type { PandaDetail } from "@/lib/types";

interface LocalizedHomePageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "吱熊猫｜认识你收藏的每一只熊猫",
    description: "搜索熊猫名字，查看真实图片、基本资料、家庭关系、生活地点和最近更新。",
  },
  en: {
    title: "ZhiPanda | Discover the pandas you care about",
    description: "Search pandas and explore real images, profiles, family relationships, places, and recent updates.",
  },
} as const;

const preferredSpherePandas = [
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

function sphereAlt(panda: PandaDetail, locale: PublicLocale): string {
  const cover = panda.cover_image_url;
  const media = panda.media.find((asset) =>
    asset.url === cover || asset.derivatives.some((derivative) => derivative.url === cover),
  );
  return (locale === "zh" ? media?.alt_zh : media?.alt_en)
    ?? (locale === "zh" ? `${panda.name_zh}的公开照片` : `Published photograph of ${panda.name_en ?? panda.name_zh}`);
}

function buildHomeSphereImages(pandas: PandaDetail[], locale: PublicLocale): ImageData[] {
  const bySlug = new Map(pandas.map((panda) => [panda.slug, panda]));
  const ordered = [
    ...preferredSpherePandas.flatMap((slug) => {
      const panda = bySlug.get(slug);
      return panda ? [panda] : [];
    }),
    ...pandas,
  ];
  const seen = new Set<string>();
  const base = ordered.filter((panda) => {
    if (!panda.cover_image_url || seen.has(panda.id)) return false;
    seen.add(panda.id);
    return true;
  }).slice(0, 20);

  if (!base.length) return [];

  return Array.from({ length: Math.max(18, base.length) }, (_, index) => {
    const panda = base[index % base.length];
    const name = locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
    const alternate = locale === "zh" ? panda.name_en : panda.name_zh;

    return {
      id: `${panda.id}-${index}`,
      src: panda.cover_image_url as string,
      alt: sphereAlt(panda, locale),
      title: name,
      description: [alternate, panda.current_location].filter(Boolean).join(" · "),
      href: `/${locale}/pandas/${panda.slug}`,
    };
  });
}

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
  const view = buildEditorialHomeViewModel(envelope, locale);
  const sphereImages = buildHomeSphereImages(envelope.data.pandas, locale);

  return (
    <EditorialHomePage
      locale={locale}
      view={view}
      sphereImages={sphereImages}
      release={envelope.release}
      delivery={envelope.delivery}
      coverage={envelope.coverage}
      localeDelivery={envelope.locale}
    />
  );
}
