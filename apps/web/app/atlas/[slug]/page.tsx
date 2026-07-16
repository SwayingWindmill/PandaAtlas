import type { Route } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { resolvePublishedPandaReference } from "@/features/public-content/public-release";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";

interface LegacyPandaPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PublicSearchParams>;
}

export default async function LegacyPandaPage({ params, searchParams }: LegacyPandaPageProps) {
  const [{ slug }, query, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const reference = resolvePublishedPandaReference(slug);
  if (!reference) notFound();

  const locale = resolvePreferredPublicLocale(requestHeaders.get("accept-language"));
  permanentRedirect(
    localizedPublicDestination(locale, `/atlas/${reference.slug}`, query) as Route,
  );
}
