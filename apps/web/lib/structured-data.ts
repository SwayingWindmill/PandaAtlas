import { localizedPath, publicLanguageTag, type PublicLocale } from "@/lib/locales";
import { ZHIPANDA_PUBLIC_ORIGIN } from "@/lib/public-metadata";

export type StructuredData = Record<string, unknown>;

export function serializeStructuredData(value: StructuredData): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

export function publicPageUrl(locale: PublicLocale, path: string): string {
  return new URL(localizedPath(locale, path), ZHIPANDA_PUBLIC_ORIGIN).toString();
}

function pandaReference(locale: PublicLocale, panda: { slug: string; name: string }): StructuredData {
  const url = publicPageUrl(locale, `/pandas/${panda.slug}`);
  return { "@type": "Thing", "@id": `${url}#panda`, name: panda.name, url };
}

function address(parts: { country?: string | null; region?: string | null; locality?: string | null }): StructuredData | null {
  if (!parts.country && !parts.region && !parts.locality) return null;
  return {
    "@type": "PostalAddress",
    ...(parts.country ? { addressCountry: parts.country } : {}),
    ...(parts.region ? { addressRegion: parts.region } : {}),
    ...(parts.locality ? { addressLocality: parts.locality } : {}),
  };
}

// Schema.org has Zoo but nothing closer for a breeding or research base.
const institutionSchemaType = {
  zoo: "Zoo",
  wildlife_park: "Zoo",
  breeding_center: "ResearchOrganization",
} as const;

interface InstitutionStructuredDataInput {
  locale: PublicLocale;
  slug: string;
  name: string;
  alternateName: string | null;
  kind: keyof typeof institutionSchemaType | null;
  summary: string | null;
  websiteUrl: string | null;
  country: string | null;
  region: string | null;
}

export function buildInstitutionStructuredData(input: InstitutionStructuredDataInput): StructuredData {
  const url = publicPageUrl(input.locale, `/institutions/${input.slug}`);
  const postalAddress = address({ country: input.country, region: input.region });
  return {
    "@context": "https://schema.org",
    "@type": input.kind ? institutionSchemaType[input.kind] : "Organization",
    "@id": `${url}#institution`,
    url,
    mainEntityOfPage: url,
    name: input.name,
    ...(input.alternateName ? { alternateName: input.alternateName } : {}),
    ...(input.summary ? { description: input.summary } : {}),
    ...(input.websiteUrl ? { sameAs: [input.websiteUrl] } : {}),
    ...(postalAddress ? { address: postalAddress } : {}),
  };
}

interface PlaceStructuredDataInput {
  locale: PublicLocale;
  stableId: string;
  slug: string;
  name: string;
  alternateName: string | null;
  country: string | null;
  locality: string | null;
}

export function buildPlaceStructuredData(input: PlaceStructuredDataInput): StructuredData {
  const url = publicPageUrl(input.locale, `/places/${input.slug}`);
  const postalAddress = address({ country: input.country, locality: input.locality });
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": `${url}#place`,
    url,
    mainEntityOfPage: url,
    identifier: { "@type": "PropertyValue", propertyID: "ZhiPanda stable place ID", value: input.stableId },
    name: input.name,
    ...(input.alternateName ? { alternateName: input.alternateName } : {}),
    ...(postalAddress ? { address: postalAddress } : {}),
  };
}

interface FamilyStructuredDataInput {
  locale: PublicLocale;
  slug: string;
  title: string;
  summary: string;
  members: Array<{ slug: string; name: string }>;
}

export function buildFamilyStructuredData(input: FamilyStructuredDataInput): StructuredData {
  const url = publicPageUrl(input.locale, `/families/${input.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#family`,
    url,
    mainEntityOfPage: url,
    headline: input.title,
    description: input.summary,
    inLanguage: publicLanguageTag(input.locale),
    publisher: { "@type": "Organization", name: "ZhiPanda", url: ZHIPANDA_PUBLIC_ORIGIN.toString() },
    about: input.members.map((panda) => pandaReference(input.locale, panda)),
  };
}

interface LearnArticleStructuredDataInput {
  locale: PublicLocale;
  slug: string;
  headline: string;
  description: string;
  imageUrl: string | null;
  about: Array<{ slug: string; name: string }>;
  citations: Array<{ title: string; url: string }>;
}

export function buildLearnArticleStructuredData(input: LearnArticleStructuredDataInput): StructuredData {
  const url = publicPageUrl(input.locale, `/learn/articles/${input.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    url,
    mainEntityOfPage: url,
    headline: input.headline,
    description: input.description,
    inLanguage: publicLanguageTag(input.locale),
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    publisher: { "@type": "Organization", name: "ZhiPanda", url: ZHIPANDA_PUBLIC_ORIGIN.toString() },
    ...(input.about.length ? { about: input.about.map((panda) => pandaReference(input.locale, panda)) } : {}),
    citation: input.citations.map((citation) => ({ "@type": "CreativeWork", name: citation.title, url: citation.url })),
  };
}
