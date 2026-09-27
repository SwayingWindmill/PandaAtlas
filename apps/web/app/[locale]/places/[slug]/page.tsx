import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PublicEntityPage } from "@/components/patterns/public-entity-page";
import { PlaceCheckinControl } from "@/components/places/place-checkin-control";
import { buildPlacePageViewModel } from "@/features/places/place-page-view-model";
import { loadV2PublicPlace } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface PlacePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 60;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const envelope = locale ? await loadV2PublicPlace(slug, locale) : null;
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

export default async function PlacePage({ params }: PlacePageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const envelope = await loadV2PublicPlace(slug, locale);
  if (!envelope) notFound();
  if (slug !== envelope.data.place.canonical_slug) {
    permanentRedirect(`/${locale}/places/${envelope.data.place.canonical_slug}` as Route);
  }
  const entity = buildPlacePageViewModel(envelope, locale);
  return (
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
  );
}
