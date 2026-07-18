import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicEntityPage } from "@/components/patterns/public-entity-page";
import { buildInstitutionPageViewModel } from "@/features/institutions/institution-page-view-model";
import {
  loadPublishedInstitution,
  resolvePublishedInstitutionReference,
} from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";

interface InstitutionPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PublicSearchParams>;
}

export async function generateMetadata({ params }: InstitutionPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const envelope = locale ? loadPublishedInstitution(slug, locale) : null;
  if (!locale || !envelope) return {};
  const entity = buildInstitutionPageViewModel(envelope, locale);
  return {
    title: locale === "zh" ? `${entity.displayName} | 机构实体` : `${entity.displayName} | Institution entity`,
    description: entity.summary,
    alternates: {
      canonical: `/${locale}/institutions/${entity.canonicalSlug}`,
      languages: {
        "zh-CN": `/zh/institutions/${entity.canonicalSlug}`,
        en: `/en/institutions/${entity.canonicalSlug}`,
        "x-default": `/zh/institutions/${entity.canonicalSlug}`,
      },
    },
  };
}

export default async function InstitutionPage({ params, searchParams }: InstitutionPageProps) {
  const [{ locale: rawLocale, slug }, query] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const reference = resolvePublishedInstitutionReference(slug);
  if (!reference) notFound();
  if (slug !== reference.slug) {
    permanentRedirect(
      localizedPublicDestination(locale, `/institutions/${reference.slug}`, query) as Route,
    );
  }
  const envelope = loadPublishedInstitution(reference.slug, locale);
  if (!envelope) notFound();
  const entity = buildInstitutionPageViewModel(envelope, locale);
  return (
    <PublicEntityPage
      locale={locale}
      entity={entity}
      release={envelope.release}
      delivery={envelope.delivery}
      coverage={envelope.coverage}
      localeDelivery={envelope.locale}
    />
  );
}
