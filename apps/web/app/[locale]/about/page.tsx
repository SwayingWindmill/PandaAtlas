import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AboutPage, aboutCopy } from "@/features/about/about-page";
import { isCommunityIntakeUiEnabled } from "@/lib/feature-flags";
import { parsePublicLocale } from "@/lib/locales";
import { buildPublicMetadata } from "@/lib/public-metadata";

interface AboutRouteProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutRouteProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const copy = aboutCopy[locale];
  return buildPublicMetadata({
    locale,
    title: locale === "zh" ? "关于吱熊猫" : "About ZhiPanda",
    description: copy.description,
    path: "/about",
  });
}

export default async function AboutRoute({ params }: AboutRouteProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  return <AboutPage locale={locale} correctionsEnabled={isCommunityIntakeUiEnabled()} />;
}
