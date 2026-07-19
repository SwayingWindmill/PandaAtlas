import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyPandasPage } from "@/features/my-pandas/my-pandas-page";
import { buildMyPandasViewModel } from "@/features/my-pandas/my-pandas-view-model";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LocalizedMyPandasPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "我的熊猫 | 本地收藏与最近浏览",
    description: "查看只保存在当前浏览器中的熊猫收藏与最近浏览；不含账户、云同步、推荐或公开排名。",
  },
  en: {
    title: "My Pandas | Local saved and recent profiles",
    description: "Review panda profiles saved or recently viewed only in this browser, without accounts, cloud sync, recommendations, or public rankings.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedMyPandasPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return {
    title: t.title,
    description: t.description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/${locale}/my-pandas`,
      languages: {
        "zh-CN": "/zh/my-pandas",
        en: "/en/my-pandas",
        "x-default": "/zh/my-pandas",
      },
    },
  };
}

export default async function LocalizedMyPandasPage({ params }: LocalizedMyPandasPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedAtlasDataset(locale);
  const view = buildMyPandasViewModel(envelope.data, locale);
  return <MyPandasPage locale={locale} view={view} envelope={envelope} />;
}
