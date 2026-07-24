import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  localizedLineageMetadata,
  renderLocalizedLineageRoute,
  type StructuredLineageSearchParams,
} from "@/features/lineage";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LocalizedLineagePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<StructuredLineageSearchParams>;
}

export async function generateMetadata({ params }: LocalizedLineagePageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  return locale ? localizedLineageMetadata(locale) : {};
}

export default async function LocalizedLineagePage({
  params,
  searchParams,
}: LocalizedLineagePageProps) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  return renderLocalizedLineageRoute(locale, rawQuery);
}
