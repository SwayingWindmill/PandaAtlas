import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TrustedPandaProfile } from "@/components/atlas/trusted-panda-profile";
import {
  loadPublishedPandaProfile,
  resolvePublishedPandaReference,
} from "@/features/public-content/public-release";
import { buildTrustedProfilePageViewModel } from "@/features/profile/profile-page-view-model";
import { parsePublicLocale } from "@/foundation/content/locales";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";
import { getPandaLineage } from "@/lib/api-client";

interface LocalizedPandaPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PublicSearchParams>;
}

export async function generateMetadata({ params }: LocalizedPandaPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = parsePublicLocale(rawLocale);
  const envelope = locale ? loadPublishedPandaProfile(slug, locale) : null;
  if (!locale || !envelope) return {};

  const { panda } = envelope.data;
  const profile = buildTrustedProfilePageViewModel(panda, locale);
  const title = locale === "zh"
    ? `${profile.displayName} | 大熊猫可信档案`
    : `${profile.displayName} | Trusted giant panda profile`;

  return {
    title,
    description: profile.summary ?? undefined,
    alternates: {
      canonical: `/${locale}/atlas/${profile.canonicalSlug}`,
      languages: {
        "zh-CN": `/zh/atlas/${profile.canonicalSlug}`,
        en: `/en/atlas/${profile.canonicalSlug}`,
        "x-default": `/zh/atlas/${profile.canonicalSlug}`,
      },
    },
  };
}

export default async function LocalizedPandaPage({ params, searchParams }: LocalizedPandaPageProps) {
  const [{ locale: rawLocale, slug }, query] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const reference = resolvePublishedPandaReference(slug);
  if (!reference) notFound();
  if (slug !== reference.slug) {
    permanentRedirect(
      localizedPublicDestination(locale, `/atlas/${reference.slug}`, query) as Route,
    );
  }

  const envelope = loadPublishedPandaProfile(reference.slug, locale);
  if (!envelope) notFound();

  const { panda } = envelope.data;
  const profile = buildTrustedProfilePageViewModel(panda, locale);

  const lineage = await getPandaLineage(profile.canonicalSlug, {
    ancestorDepth: 8,
    descendantDepth: 8,
    reference: { id: panda.id, slug: profile.canonicalSlug },
  });

  return (
    <TrustedPandaProfile
      locale={locale}
      panda={panda}
      lineage={lineage}
      profile={profile}
      envelope={envelope}
    />
  );
}
