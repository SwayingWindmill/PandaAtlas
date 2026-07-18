import type { Route } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { resolvePublishedInstitutionReference } from "@/features/public-content/public-release";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";

interface LegacyInstitutionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PublicSearchParams>;
}

export default async function LegacyInstitutionPage({ params, searchParams }: LegacyInstitutionPageProps) {
  const [{ slug }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const reference = resolvePublishedInstitutionReference(slug);
  if (!reference) notFound();
  const locale = resolvePreferredPublicLocale(requestHeaders.get("accept-language"));
  permanentRedirect(
    localizedPublicDestination(locale, `/institutions/${reference.slug}`, query) as Route,
  );
}
