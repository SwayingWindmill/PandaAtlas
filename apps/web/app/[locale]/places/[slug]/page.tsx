import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { StructuredDataScript } from "@/components/structured-data-script";
import { PublicEntityPage } from "@/features/places/public-entity-page";
import { PlaceCheckinControl } from "@/features/places/place-checkin-control";
import { buildPlacePageViewModel } from "@/features/places/place-page-view-model";
import {
  loadV2PublicPlace,
  resolveV2InstitutionSlugForPlace,
  resolveV2PublicPlaceReference,
} from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/lib/locales";
import { buildPublicMetadata } from "@/lib/public-metadata";
import { buildPlaceStructuredData } from "@/lib/structured-data";
import { readPublicMetadata } from "@/lib/server/public-read";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/lib/public-redirects";

interface PlacePageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PublicSearchParams>;
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const envelope = locale ? await readPublicMetadata(() => loadV2PublicPlace(slug, locale)) : null;
  if (!locale || !envelope) return {};
  const entity = buildPlacePageViewModel(envelope, locale);
  return buildPublicMetadata({
    locale,
    title: locale === "zh"
      ? `${entity.displayName} | 熊猫生活地点 | 吱熊猫`
      : `${entity.displayName} | Panda place | ZhiPanda`,
    description: entity.summary,
    path: `/places/${entity.canonicalSlug}`,
  });
}

export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const [{ locale: rawLocale, slug }, query] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const reference = await resolveV2PublicPlaceReference(slug);
  if (!reference) notFound();
  // Zoos and breeding centers are presented on their institution page; place pages are for wild areas.
  const institutionSlug = await resolveV2InstitutionSlugForPlace(reference.id);
  if (institutionSlug) {
    permanentRedirect(localizedPublicDestination(locale, `/institutions/${institutionSlug}`, query) as Route);
  }
  if (slug !== reference.slug) {
    permanentRedirect(
      localizedPublicDestination(locale, `/places/${reference.slug}`, query) as Route,
    );
  }
  const envelope = await loadV2PublicPlace(reference.slug, locale);
  if (!envelope) notFound();
  const entity = buildPlacePageViewModel(envelope, locale);
  const { place } = envelope.data;
  return (
    <>
      <StructuredDataScript
        testId="place-structured-data"
        data={buildPlaceStructuredData({
          locale,
          stableId: entity.stableId,
          slug: entity.canonicalSlug,
          name: entity.displayName,
          alternateName: entity.alternateName,
          country: place.country_code,
          locality: place.locality,
        })}
      />
      <PublicEntityPage
        locale={locale}
        entity={entity}
        release={envelope.release}
        delivery={envelope.delivery}
        coverage={envelope.coverage}
        localeDelivery={envelope.locale}
        fanAction={(
          <PlaceCheckinControl
            placeId={entity.stableId}
            slug={entity.canonicalSlug}
            name={entity.displayName}
            locale={locale}
          />
        )}
      />
    </>
  );
}
