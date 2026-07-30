import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyPandasPage } from "@/features/my-pandas/my-pandas-page";
import { buildMyPandasViewModel } from "@/features/my-pandas/my-pandas-view-model";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LocalizedPassportPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "我的熊猫 | 吱熊猫",
    description: "查看账号私有的熊猫护照与当前浏览器最近记录；不提供公开用户主页或排名。",
  },
  en: {
    title: "My pandas | ZhiPanda",
    description: "Review your private Panda Passport and profiles recently viewed in this browser, without a public user profile or ranking.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedPassportPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/me/passport",
    privatePage: true,
  });
}

export default async function LocalizedPassportPage({ params }: LocalizedPassportPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedAtlasDataset(locale);
  const view = buildMyPandasViewModel(envelope.data, locale);
  return <MyPandasPage locale={locale} view={view} envelope={envelope} />;
}
