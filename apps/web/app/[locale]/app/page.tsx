import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppDownloadPage, appPageCopy } from "@/features/app-download/app-download-page";
import { appDownloadLinks } from "@/lib/app-download";
import { parsePublicLocale } from "@/lib/locales";
import { buildPublicMetadata } from "@/lib/public-metadata";

interface AppRouteProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AppRouteProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  return buildPublicMetadata({
    locale,
    title: locale === "zh" ? "下载吱熊猫 App" : "Get the ZhiPanda app",
    description: appPageCopy[locale].description,
    path: "/app",
  });
}

export default async function AppRoute({ params }: AppRouteProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  return <AppDownloadPage locale={locale} links={appDownloadLinks()} />;
}
