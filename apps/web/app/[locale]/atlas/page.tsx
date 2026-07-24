import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  localizedAtlasMetadata,
  renderLocalizedAtlasRoute,
  type AtlasSearchParams,
} from "@/features/atlas";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LocalizedAtlasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<AtlasSearchParams>;
}

export async function generateMetadata({ params }: LocalizedAtlasPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  return locale ? localizedAtlasMetadata(locale) : {};
}

export default async function LocalizedAtlasPage({ params, searchParams }: LocalizedAtlasPageProps) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  return renderLocalizedAtlasRoute(locale, rawQuery);
}
