import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomePage } from "@/features/home/home-page";
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
  const baseModel = buildHomeV09ViewModel(envelope.data, locale);
  const model = withHomeV09Media(baseModel, await loadV2PandaCovers(homeV09PandaIds(baseModel)), locale);

  return (
    <main id="main-content" data-testid="localized-home-page">
      <HomePage locale={locale} model={model} />
    </main>
  );
}
