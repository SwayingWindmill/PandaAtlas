import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { loadPublicPandaActivity } from "@/features/feed/feed-api";
import { loadV2PublicPandaProfile } from "@/features/public-content/public-v2";
import { buildTrustedProfilePageViewModel } from "@/features/profile/profile-page-view-model";
import { TrustedProfilePage } from "@/features/profile/trusted-profile-page";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LocalizedPandaPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 60;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export async function generateMetadata({ params }: LocalizedPandaPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const envelope = locale ? await loadV2PublicPandaProfile(slug, locale) : null;
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

export default async function LocalizedPandaPage({ params }: LocalizedPandaPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = await loadV2PublicPandaProfile(slug, locale);
  if (!envelope) notFound();
  if (slug !== envelope.data.panda.slug) {
    permanentRedirect(`/${locale}/pandas/${envelope.data.panda.slug}` as Route);
  }

  const profile = buildTrustedProfilePageViewModel(envelope.data, locale);
  const activityResult = await loadPublicPandaActivity(profile.stableId);

  return (
    <TrustedProfilePage
      locale={locale}
      profile={profile}
      envelope={envelope}
      activity={activityResult.state === "ready" ? activityResult.page : undefined}
      activityUnavailable={activityResult.state === "unavailable"}
      activityPandas={[envelope.data.panda]}
    />
  );
}
