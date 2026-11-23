import type { MetadataRoute } from "next";

import {
  loadV2PublicAtlasDataset,
  loadV2PublicInstitutionSlugs,
  loadV2PublicPlaceSlugs,
} from "@/features/public-content/public-v2";
import { articleLocale, loadLearningCatalog, termLocale } from "@/features/learn/learning";
import { listFamilyStories } from "@/features/public-experiences/stories";

const siteUrl = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [institutionSlugs, placeSlugs, learning] = await Promise.all([
    loadV2PublicInstitutionSlugs(),
    loadV2PublicPlaceSlugs(),
    loadLearningCatalog(),
  ]);
  const familySlugs = listFamilyStories().map((story) => story.slug);
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of ["zh", "en"] as const) {
    entries.push(
      { url: `${siteUrl}/${locale}`, changeFrequency: "weekly", priority: 1 },
      { url: `${siteUrl}/${locale}/pandas`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${siteUrl}/${locale}/map`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${siteUrl}/${locale}/moments`, changeFrequency: "daily", priority: 0.7 },
      { url: `${siteUrl}/${locale}/families`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${siteUrl}/${locale}/games`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${siteUrl}/${locale}/games/guess`, changeFrequency: "monthly", priority: 0.5 },
      { url: `${siteUrl}/${locale}/games/daily`, changeFrequency: "daily", priority: 0.5 },
      { url: `${siteUrl}/${locale}/terms`, changeFrequency: "monthly", priority: 0.3 },
      { url: `${siteUrl}/${locale}/privacy`, changeFrequency: "monthly", priority: 0.3 },
      { url: `${siteUrl}/${locale}/about`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${siteUrl}/${locale}/app`, changeFrequency: "monthly", priority: 0.5 },
      { url: `${siteUrl}/${locale}/learn`, changeFrequency: "weekly", priority: 0.8 },
    );

    for (const article of learning.articles) {
      if (articleLocale(article, locale) !== locale) continue;
      entries.push({ url: `${siteUrl}/${locale}/learn/articles/${article.slug}`, changeFrequency: "monthly", priority: 0.7 });
    }
    for (const term of learning.terms) {
      if (termLocale(term, locale) !== locale) continue;
      entries.push({ url: `${siteUrl}/${locale}/learn/terms/${term.slug}`, changeFrequency: "monthly", priority: 0.5 });
    }

    for (const slug of institutionSlugs) {
      entries.push({ url: `${siteUrl}/${locale}/institutions/${slug}`, changeFrequency: "monthly", priority: 0.7 });
    }
    for (const slug of placeSlugs) {
      entries.push({ url: `${siteUrl}/${locale}/places/${slug}`, changeFrequency: "monthly", priority: 0.6 });
    }
    for (const slug of familySlugs) {
      entries.push({ url: `${siteUrl}/${locale}/families/${slug}`, changeFrequency: "monthly", priority: 0.6 });
    }
    const envelope = await loadV2PublicAtlasDataset(locale);
    for (const panda of envelope.data.pandas) {
      entries.push({
        url: `${siteUrl}/${locale}/pandas/${panda.slug}`,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  }
  return entries;
}
