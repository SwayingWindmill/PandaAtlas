import type { Route } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";
import {
  localizedPublicDestination,
  type PublicSearchParams,
} from "@/foundation/routing/public-redirects";

interface LegacyLineagePageProps {
  searchParams: Promise<PublicSearchParams>;
}

export default async function LegacyLineagePage({ searchParams }: LegacyLineagePageProps) {
  const [requestHeaders, query] = await Promise.all([headers(), searchParams]);
  const locale = resolvePreferredPublicLocale(requestHeaders.get("accept-language"));
  permanentRedirect(localizedPublicDestination(locale, "/lineage", query) as Route);
}
