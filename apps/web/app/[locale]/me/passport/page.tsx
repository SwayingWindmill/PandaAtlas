import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { parsePublicLocale } from "@/foundation/content/locales";

interface LocalizedPassportPageProps {
  params: Promise<{ locale: string }>;
}

export default async function LocalizedPassportPage({ params }: LocalizedPassportPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  permanentRedirect(`/${locale}/me` as Route);
}
