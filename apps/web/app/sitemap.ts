import type { MetadataRoute } from "next";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";

const siteUrl = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of ["zh", "en"] as const) {
    const dataset = loadPublishedAtlasDataset(locale).data;
    entries.push(
      { url: `${siteUrl}/${locale}`, changeFrequency: "weekly", priority: 1 },
      { url: `${siteUrl}/${locale}/pandas`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${siteUrl}/${locale}/map`, changeFrequency: "weekly", priority: 0.7 },
      { url: `${siteUrl}/${locale}/lineage`, changeFrequency: "weekly", priority: 0.7 },
    );
    for (const panda of dataset.pandas) {
      entries.push({
        url: `${siteUrl}/${locale}/pandas/${panda.slug}`,
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  }
  return entries;
}
