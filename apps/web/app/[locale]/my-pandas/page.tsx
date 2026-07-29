import type { Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { parsePublicLocale } from "@/foundation/content/locales";

interface LegacyMyPandasPageProps {
  params: Promise<{ locale: string }>;
}

export default async function LegacyMyPandasPage({ params }: LegacyMyPandasPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  permanentRedirect(`/${locale}/me/passport` as Route);
}
