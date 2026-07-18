import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicEntityPage } from "@/components/patterns/public-entity-page";
import { buildPlacePageViewModel } from "@/features/places/place-page-view-model";
import {
  loadPublishedPlace,
  resolvePublishedPlaceReference,
} from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";

interface PlacePageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PublicSearchParams>;
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const envelope = locale ? loadPublishedPlace(slug, locale) : null;
  if (!locale || !envelope) return {};
  const entity = buildPlacePageViewModel(envelope, locale);
  return {
    title: locale === "zh" ? `${entity.displayName} | 场所实体` : `${entity.displayName} | Place entity`,
    description: entity.summary,
    alternates: {
      canonical: `/${locale}/places/${entity.canonicalSlug}`,
      languages: {
        "zh-CN": `/zh/places/${entity.canonicalSlug}`,
        en: `/en/places/${entity.canonicalSlug}`,
        "x-default": `/zh/places/${entity.canonicalSlug}`,
      },
    },
  };
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const [{ locale: rawLocale, slug }, query] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const reference = resolvePublishedPlaceReference(slug);
  if (!reference) notFound();
  if (slug !== reference.slug) {
    permanentRedirect(
      localizedPublicDestination(locale, `/places/${reference.slug}`, query) as Route,
    );
  }
  const envelope = loadPublishedPlace(reference.slug, locale);
  if (!envelope) notFound();
  const entity = buildPlacePageViewModel(envelope, locale);
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
