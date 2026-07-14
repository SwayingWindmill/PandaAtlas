import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TrustedPandaProfile, type PublicProfileLocale } from "@/components/atlas/trusted-panda-profile";
import { getPandaDetail, getPandaLineage, resolvePandaReference } from "@/lib/api-client";

interface LocalizedPandaPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

function parseLocale(value: string): PublicProfileLocale | null {
  return value === "zh" || value === "en" ? value : null;
}

export async function generateMetadata({ params }: LocalizedPandaPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parseLocale(rawLocale);
  const reference = locale ? await resolvePandaReference(slug) : null;
  const panda = reference ? await getPandaDetail(reference.slug, reference) : null;
  if (!locale || !reference || !panda?.identity) return {};

  const title = locale === "zh"
    ? `${panda.name_zh} | 大熊猫可信档案`
    : `${panda.name_en ?? panda.name_zh} | Trusted giant panda profile`;
  const description = panda.localized_content.find(
    (item) => item.locale === (locale === "zh" ? "zh-CN" : "en"),
  )?.summary ?? panda.intro ?? undefined;
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/atlas/${reference.slug}`,
      languages: {
        "zh-CN": `/zh/atlas/${reference.slug}`,
        en: `/en/atlas/${reference.slug}`,
      },
    },
  };
}

export default async function LocalizedPandaPage({ params }: LocalizedPandaPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = parseLocale(rawLocale);
  if (!locale) notFound();

  const reference = await resolvePandaReference(slug);
  if (!reference) notFound();
  if (slug !== reference.slug) permanentRedirect(`/${locale}/atlas/${reference.slug}` as Route);

  const [panda, lineage] = await Promise.all([
    getPandaDetail(reference.slug, reference),
    getPandaLineage(reference.slug, { ancestorDepth: 8, descendantDepth: 8, reference }),
  ]);
  if (panda?.slug !== reference.slug || !panda.identity) notFound();

  return <TrustedPandaProfile locale={locale} panda={panda} lineage={lineage} />;
}
