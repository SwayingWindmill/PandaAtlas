import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { resolvePublishedPandaReference } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LegacyAtlasProfileProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function LegacyAtlasProfile({ params }: LegacyAtlasProfileProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const reference = resolvePublishedPandaReference(slug);
  if (!reference) notFound();
  permanentRedirect(`/${locale}/pandas/${reference.slug}` as Route);
}
