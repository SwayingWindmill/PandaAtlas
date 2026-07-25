import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorialHomePage } from "@/features/home/editorial-home-page";
import { buildEditorialHomeViewModel } from "@/features/home/editorial-home-view-model";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LocalizedHomePageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "吱熊猫｜认识你关注的每一只熊猫",
    description: "搜索熊猫名字，查看真实图片、基本资料、家庭关系、生活地点和最近更新。",
  },
  en: {
    title: "ZhiPanda | Discover the pandas you care about",
    description: "Search pandas and explore real images, profiles, family relationships, places, and recent updates.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedHomePageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { "zh-CN": "/zh", en: "/en", "x-default": "/zh" },
    },
  };
}

export default async function LocalizedHomePage({ params }: LocalizedHomePageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedAtlasDataset(locale);
  const view = buildEditorialHomeViewModel(envelope, locale);

  return (
    <EditorialHomePage
      locale={locale}
      view={view}
      release={envelope.release}
      delivery={envelope.delivery}
      coverage={envelope.coverage}
      localeDelivery={envelope.locale}
    />
  );
}
