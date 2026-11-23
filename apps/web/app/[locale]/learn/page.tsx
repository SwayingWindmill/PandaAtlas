import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { learnIndexCopy, LearnIndexPage } from "@/features/learn/learn-index-page";
import { loadLearningCatalog } from "@/features/learn/learning";
import { parsePublicLocale } from "@/lib/locales";
import { buildPublicMetadata } from "@/lib/public-metadata";
import { readPublicMetadata } from "@/lib/server/public-read";

interface LearnRouteProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LearnRouteProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  const catalog = locale ? await readPublicMetadata(loadLearningCatalog) : null;
  if (!locale || !catalog) return {};
  return buildPublicMetadata({
    locale,
    title: locale === "zh" ? "熊猫科普 | 吱熊猫" : "Learn about pandas | ZhiPanda",
    description: learnIndexCopy[locale].description(catalog.articles.length, catalog.terms.length),
    path: "/learn",
  });
}

export default async function LearnRoute({ params }: LearnRouteProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  return <LearnIndexPage locale={locale} catalog={await loadLearningCatalog()} />;
}
