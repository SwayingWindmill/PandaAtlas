import { localizedPath, type PublicLocale } from "@/foundation/content/locales";
import { ZHIPANDA_PUBLIC_ORIGIN } from "@/foundation/metadata/public-metadata";

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
}: PandaStructuredDataInput): Record<string, unknown> {
  const url = new URL(
    localizedPath(locale, `/pandas/${canonicalSlug}`),
    ZHIPANDA_PUBLIC_ORIGIN,
  ).toString();
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

export function serializeStructuredData(value: Record<string, unknown>): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
