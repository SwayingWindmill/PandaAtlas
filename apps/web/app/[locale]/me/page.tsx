import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MyPandasPage } from "@/features/my-pandas/my-pandas-page";
import { buildMyPandasViewModel } from "@/features/my-pandas/my-pandas-view-model";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LocalizedMyPandasPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "我的熊猫 | 吱熊猫",
    description: "管理收藏、动态、通知、足迹、游戏记录与其他账号私有熊猫体验。",
  },
  en: {
    title: "My Pandas | ZhiPanda",
    description: "Manage favorites, activity, notifications, visits, game history, and other private panda experiences for your account.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedMyPandasPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/me",
    privatePage: true,
  });
}

export default async function LocalizedMyPandasPage({ params }: LocalizedMyPandasPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();
  const view = buildMyPandasViewModel(envelope.data, locale);
  return <MyPandasPage locale={locale} view={view} envelope={envelope} />;
}
