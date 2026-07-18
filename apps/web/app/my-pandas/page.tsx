import type { Route } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";

export default async function LegacyMyPandasPage() {
  const requestHeaders = await headers();
  const locale = resolvePreferredPublicLocale(requestHeaders.get("accept-language"));
  permanentRedirect(`/${locale}/my-pandas` as Route);
}
