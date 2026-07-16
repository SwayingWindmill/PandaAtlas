import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  loadPublishedPandaProfile,
  resolvePublishedPandaReference,
} from "@/features/public-content/public-release";
import { buildTrustedProfilePageViewModel } from "@/features/profile/profile-page-view-model";
import { TrustedProfilePage } from "@/features/profile/trusted-profile-page";
import { parsePublicLocale } from "@/foundation/content/locales";
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

  const profile = buildTrustedProfilePageViewModel(envelope.data, locale);

  return <TrustedProfilePage locale={locale} profile={profile} envelope={envelope} />;
}
