import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { legalDocument } from "@/features/legal/documents";
import { LegalDocumentPage } from "@/features/legal/legal-document-page";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LegalPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const document = legalDocument(locale, "privacy");
  return buildPublicMetadata({
    locale,
    title: `${document.title} | ${locale === "zh" ? "吱熊猫" : "ZhiPanda"}`,
    description: document.description,
    path: document.path,
  });
}

export default async function PrivacyPage({ params }: LegalPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  return <LegalDocumentPage locale={locale} document={legalDocument(locale, "privacy")} />;
}
