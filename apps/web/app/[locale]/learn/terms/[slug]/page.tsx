import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LearnTermPage } from "@/features/learn/learn-term-page";
import { learningText, loadLearningCatalog } from "@/features/learn/learning";
import { parsePublicLocale } from "@/lib/locales";
import { buildPublicMetadata } from "@/lib/public-metadata";
import { readPublicMetadata } from "@/lib/server/public-read";

interface TermRouteProps {
  params: Promise<{ locale: string; slug: string }>;
}

async function findTerm(rawLocale: string, slug: string) {
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return null;
  const catalog = await loadLearningCatalog();
  const term = catalog.terms.find((item) => item.slug === slug);
  return term ? { locale, catalog, term } : null;
}

export async function generateMetadata({ params }: TermRouteProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const found = await readPublicMetadata(() => findTerm(rawLocale, slug));
  if (!found) return {};
  const { locale, term } = found;
  return buildPublicMetadata({
    locale,
    title: `${learningText(term.term, locale)} | ${locale === "zh" ? "熊猫科普 | 吱熊猫" : "Panda terms | ZhiPanda"}`,
    description: learningText(term.definition, locale),
    path: `/learn/terms/${term.slug}`,
  });
}

export default async function TermRoute({ params }: TermRouteProps) {
  const { locale: rawLocale, slug } = await params;
  const found = await findTerm(rawLocale, slug);
  if (!found) notFound();
  return <LearnTermPage locale={found.locale} term={found.term} catalog={found.catalog} />;
}
