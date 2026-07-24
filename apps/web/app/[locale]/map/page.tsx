import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  localizedMapMetadata,
  renderLocalizedMapRoute,
  type StructuredMapSearchParams,
} from "@/features/map";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LocalizedMapPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<StructuredMapSearchParams>;
}

export async function generateMetadata({ params }: LocalizedMapPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  return locale ? localizedMapMetadata(locale) : {};
}

export default async function LocalizedMapPage({ params, searchParams }: LocalizedMapPageProps) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  return renderLocalizedMapRoute(locale, rawQuery);
}
