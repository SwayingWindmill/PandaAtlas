import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { FanLibraryPage } from "@/features/my-pandas/fan-library-page";
import { buildMyPandasViewModel } from "@/features/my-pandas/my-pandas-view-model";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface CollectionsPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "收藏与合集 | 吱熊猫",
    description: "整理你喜欢的熊猫，建立自己的私人熊猫合集。",
  },
  en: {
    title: "Favorites & collections | ZhiPanda",
    description: "Organize the pandas you love into private personal collections.",
  },
} as const;

export async function generateMetadata({ params }: CollectionsPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/me/collections",
    privatePage: true,
  });
}

export default async function CollectionsPage({ params }: CollectionsPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedAtlasDataset(locale);
  const view = buildMyPandasViewModel(envelope.data, locale);
  const alternateLocale = locale === "zh" ? "en" : "zh";

  return (
    <>
      <GlobalNavigation
        locale={locale}
        active="my-pandas"
        alternatePath={`/${alternateLocale}/me/collections`}
      />
      <main id="main-content" className="bg-[var(--bg)] text-[var(--fg)]">
        <div className={publicShellClassName}>
          <FanLibraryPage locale={locale} profiles={view.profiles} />
        </div>
      </main>
    </>
  );
}
