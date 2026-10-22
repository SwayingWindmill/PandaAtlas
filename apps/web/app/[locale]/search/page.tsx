import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadV2PublicSearchDataset } from "@/features/public-content/public-v2";
import { listFamilyStories } from "@/features/public-experiences/stories";
import styles from "@/features/public-experiences/public-experiences.module.css";
import { buildSearchViewModel, parseSearchQuery } from "@/features/search/archive-search";
import { SearchWorkspace } from "@/features/search/search-workspace";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = {
  zh: {
    title: "搜索",
    metaTitle: "搜索 | 吱熊猫",
    description: "在已公开的熊猫档案、家族故事和地点里查找你想认识的熊猫。",
    eyebrow: "Search · 搜索",
  },
  en: {
    title: "Search",
    metaTitle: "Search | ZhiPanda",
    description: "Find pandas, family stories, and places across ZhiPanda's published records.",
    eyebrow: "Search",
  },
} as const;

export async function generateMetadata({ params, searchParams }: SearchPageProps): Promise<Metadata> {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  const state = parseSearchQuery(rawSearch);
  // Result pages are a utility over canonical profiles, not content to index on their own.
  return buildPublicMetadata({
    locale,
    title: state.q ? `${state.q} | ${t.metaTitle}` : t.metaTitle,
    description: t.description,
    path: "/search",
    privatePage: Boolean(state.q || state.type !== "all"),
  });
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const state = parseSearchQuery(rawSearch);
  const stories = listFamilyStories();
  const dataset = await loadV2PublicSearchDataset(stories);
  if (!dataset) notFound();
  const view = buildSearchViewModel({ ...dataset, stories }, state, locale);
  const t = copy[locale];

  return (
    <div className={styles.page}>
      <main id="main-content" data-testid="search-page">
        <div className={`${styles.shell} pb-16 pt-8 sm:pt-12`}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className="mt-3 mb-6 font-serif text-4xl font-black tracking-[-0.04em] sm:text-5xl">{t.title}</h1>
          <SearchWorkspace locale={locale} state={state} results={view.results} counts={view.counts} />
        </div>
      </main>
    </div>
  );
}
