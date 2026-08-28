import type { MetadataRoute } from "next";

import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";

const siteUrl = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of ["zh", "en"] as const) {
    entries.push(
      { url: `${siteUrl}/${locale}`, changeFrequency: "weekly", priority: 1 },
      { url: `${siteUrl}/${locale}/pandas`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${siteUrl}/${locale}/map`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${siteUrl}/${locale}/moments`, changeFrequency: "daily", priority: 0.7 },
      { url: `${siteUrl}/${locale}/families`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${siteUrl}/${locale}/games`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${siteUrl}/${locale}/games/random`, changeFrequency: "monthly", priority: 0.5 },
      { url: `${siteUrl}/${locale}/games/guess`, changeFrequency: "monthly", priority: 0.5 },
    );

    try {
      const envelope = await loadV2PublicAtlasDataset(locale);
      if (!envelope) continue;
      for (const panda of envelope.data.pandas) {
        entries.push({
          url: `${siteUrl}/${locale}/pandas/${panda.slug}`,
          changeFrequency: "monthly",
          priority: 0.8,
        });
      }
    } catch {
      continue;
    }
  }
  return entries;
}
