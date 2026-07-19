import type { Route } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";
import { localizedPublicDestination } from "@/foundation/routing/public-redirects";

export default async function LegacyMyPandasPage() {
  const requestHeaders = await headers();
  const locale = resolvePreferredPublicLocale(requestHeaders.get("accept-language"));
  permanentRedirect(localizedPublicDestination(locale, "/my-pandas") as Route);
}
