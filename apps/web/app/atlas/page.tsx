import type { Route } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";

interface LegacyAtlasPageProps {
  searchParams: Promise<PublicSearchParams>;
}

export default async function LegacyAtlasPage({ searchParams }: LegacyAtlasPageProps) {
  const [requestHeaders, query] = await Promise.all([headers(), searchParams]);
  const locale = resolvePreferredPublicLocale(requestHeaders.get("accept-language"));
  permanentRedirect(localizedPublicDestination(locale, "/atlas", query) as Route);
}
