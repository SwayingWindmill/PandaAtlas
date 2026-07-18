import type { Route } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { resolvePublishedPlaceReference } from "@/features/public-content/public-release";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";

interface LegacyPlacePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PublicSearchParams>;
}

export default async function LegacyPlacePage({ params, searchParams }: LegacyPlacePageProps) {
  const [{ slug }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const reference = resolvePublishedPlaceReference(slug);
  if (!reference) notFound();
  const locale = resolvePreferredPublicLocale(requestHeaders.get("accept-language"));
  permanentRedirect(
    localizedPublicDestination(locale, `/places/${reference.slug}`, query) as Route,
  );
}
