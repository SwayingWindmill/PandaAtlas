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
    title: "可信、双语的大熊猫动态档案馆",
    description: "搜索已审核大熊猫身份，从亲缘或地点继续探索，并查看最近修订、公开来源、地点精度与发布版本。",
  },
  en: {
    title: "A trusted bilingual living archive of giant pandas",
    description: "Search reviewed panda identities, explore through relationships or places, and inspect recent revisions, public sources, location precision, and release identity.",
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
