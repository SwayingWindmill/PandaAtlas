import type { PublicLocale } from "@/lib/locales";
import { publicPageUrl, type StructuredData } from "@/lib/structured-data";

interface PandaStructuredDataInput {
  locale: PublicLocale;
  stableId: string;
  canonicalSlug: string;
  displayName: string;
  alternateName?: string | null;
  pinyin?: string | null;
  summary?: string | null;
  coverImageUrl?: string | null;
}

export function buildPandaStructuredData({
  locale,
  stableId,
  canonicalSlug,
  displayName,
  alternateName,
  pinyin,
  summary,
  coverImageUrl,
}: PandaStructuredDataInput): StructuredData {
  const url = publicPageUrl(locale, `/pandas/${canonicalSlug}`);
  const alternateNames = [alternateName, pinyin]
    .filter((value): value is string => Boolean(value));

  return {
    "@context": "https://schema.org",
    "@type": "Thing",
    "@id": `${url}#panda`,
    url,
    mainEntityOfPage: url,
    identifier: {
      "@type": "PropertyValue",
      propertyID: "ZhiPanda stable panda ID",
      value: stableId,
    },
    name: displayName,
    ...(alternateNames.length ? { alternateName: alternateNames } : {}),
    ...(summary ? { description: summary } : {}),
    ...(coverImageUrl ? { image: coverImageUrl } : {}),
    inLanguage: locale === "zh" ? "zh-CN" : "en",
  };
}
