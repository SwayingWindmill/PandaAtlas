import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { loadPublicPandaActivity } from "@/features/feed/feed-api";
import {
  loadPublishedAtlasDataset,
  loadPublishedPandaProfile,
  resolvePublishedPandaReference,
} from "@/features/public-content/public-release";
import { buildTrustedProfilePageViewModel } from "@/features/profile/profile-page-view-model";
import { TrustedProfilePage } from "@/features/profile/trusted-profile-page";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";

interface LocalizedPandaPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PublicSearchParams>;
}

export async function generateMetadata({ params }: LocalizedPandaPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const envelope = locale ? loadPublishedPandaProfile(slug, locale) : null;
  if (!locale || !envelope) return {};

  const profile = buildTrustedProfilePageViewModel(envelope.data, locale);
  const title = locale === "zh"
    ? `${profile.displayName} | 大熊猫资料 | 吱熊猫`
    : `${profile.displayName} | Giant panda profile | ZhiPanda`;

  return buildPublicMetadata({
    locale,
    title,
    description: profile.summary ?? (locale === "zh" ? "查看这只大熊猫的资料、家族和生活足迹。" : "Explore this giant panda's profile, family, and life journey."),
    path: `/pandas/${profile.canonicalSlug}`,
    image: envelope.data.panda.cover_image_url
      ? { url: envelope.data.panda.cover_image_url, alt: profile.displayName }
      : null,
  });
}

export default async function LocalizedPandaPage({ params, searchParams }: LocalizedPandaPageProps) {
  const [{ locale: rawLocale, slug }, query] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const reference = resolvePublishedPandaReference(slug);
  if (!reference) notFound();
  if (slug !== reference.slug) {
    permanentRedirect(
      localizedPublicDestination(locale, `/pandas/${reference.slug}`, query) as Route,
    );
  }

  const envelope = loadPublishedPandaProfile(reference.slug, locale);
  if (!envelope) notFound();

  const profile = buildTrustedProfilePageViewModel(envelope.data, locale);
  const rawActivityCursor = query.activity_cursor;
  const activityCursor = Array.isArray(rawActivityCursor)
    ? rawActivityCursor[0]
    : rawActivityCursor;
  const activityResult = await loadPublicPandaActivity(profile.stableId, activityCursor);
  const atlas = loadPublishedAtlasDataset(locale);

  return (
    <TrustedProfilePage
      locale={locale}
      profile={profile}
      envelope={envelope}
      activity={activityResult.state === "ready" ? activityResult.page : undefined}
      activityUnavailable={activityResult.state === "unavailable"}
      activityPandas={atlas.data.pandas}
    />
  );
}
