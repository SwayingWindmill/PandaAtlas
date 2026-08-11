import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { FanMemoriesPage } from "@/features/my-pandas/fan-memories-page";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface MemoriesPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "足迹与见过 | 吱熊猫",
    description: "查看你去过的熊猫地点和亲眼见过的熊猫。",
  },
  en: {
    title: "Visits & pandas I've seen | ZhiPanda",
    description: "Review panda places you've visited and pandas you've seen in person.",
  },
} as const;

export async function generateMetadata({ params }: MemoriesPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/me/memories",
    privatePage: true,
  });
}

export default async function MemoriesPage({ params }: MemoriesPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedAtlasDataset(locale);
  const alternateLocale = locale === "zh" ? "en" : "zh";
  const pandas = envelope.data.pandas.map((panda) => ({
    id: panda.id,
    name: locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh,
    href: `/${locale}/pandas/${panda.slug}`,
  }));
  const places = envelope.data.places.map((place) => ({
    id: place.id,
    name: place.names.find((name) => name.language === (locale === "zh" ? "zh-Hans" : "en"))?.value
      ?? place.names[0]?.value
      ?? place.canonical_slug,
    href: `/${locale}/places/${place.canonical_slug}`,
  }));

  return (
    <>
      <GlobalNavigation
        locale={locale}
        active="my-pandas"
        alternatePath={`/${alternateLocale}/me/memories`}
      />
      <main id="main-content" className="bg-[var(--bg)] text-[var(--fg)]">
        <div className={publicShellClassName}>
          <FanMemoriesPage locale={locale} pandas={pandas} places={places} />
        </div>
      </main>
    </>
  );
}
