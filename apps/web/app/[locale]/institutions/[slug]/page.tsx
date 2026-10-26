import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InstitutionPage } from "@/features/institutions/institution-page";
import { buildInstitutionPageViewModel } from "@/features/institutions/institution-page-view-model";
import {
  loadV2PandaCovers,
  loadV2PublicInstitution,
  pandaCoverMedia,
  type PandaCoverMedia,
} from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface InstitutionRouteProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: InstitutionRouteProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const envelope = locale ? await loadV2PublicInstitution(slug, locale) : null;
  if (!locale || !envelope) return {};
  const view = buildInstitutionPageViewModel(envelope.data, locale);
  const fallback = locale === "zh"
    ? `${view.name}的大熊猫、参观信息和熊猫历史。`
    : `Giant pandas, visitor information and panda history at ${view.name}.`;
  return buildPublicMetadata({
    locale,
    title: locale === "zh" ? `${view.name} | 吱熊猫` : `${view.name} | ZhiPanda`,
    description: view.summary ?? fallback,
    path: `/institutions/${view.slug}`,
  });
}

export default async function InstitutionRoute({ params }: InstitutionRouteProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const envelope = await loadV2PublicInstitution(slug, locale);
  if (!envelope) notFound();
  const view = buildInstitutionPageViewModel(envelope.data, locale);
  // Photos show only current residents; the history list is text.
  const assets = await loadV2PandaCovers(view.residents.map((panda) => panda.id));
  const covers = new Map<string, PandaCoverMedia>();
  for (const panda of view.residents) {
    const asset = assets.get(panda.id);
    const media = asset ? pandaCoverMedia(asset, panda.name, locale) : null;
    if (media) covers.set(panda.id, media);
  }
  return <InstitutionPage locale={locale} view={view} covers={covers} />;
}
