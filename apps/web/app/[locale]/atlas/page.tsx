import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { atlasHref, parseAtlasQuery } from "@/features/atlas/atlas-query";
import { buildAtlasSearchViewModel } from "@/features/atlas/atlas-search";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LegacyAtlasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyAtlasPage({ params, searchParams }: LegacyAtlasPageProps) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();
  const parsed = parseAtlasQuery(rawQuery, envelope.data.facilities);
  const view = buildAtlasSearchViewModel(envelope.data.pandas, envelope.data.facilities, parsed.state, locale);
  permanentRedirect(atlasHref(locale, { ...parsed.state, page: view.page }) as Route);
}
