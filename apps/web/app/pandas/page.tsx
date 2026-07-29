import type { Route } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";

import { resolvePreferredPublicLocale } from "@/foundation/content/locales";

export default async function UnlocalizedPandasPage() {
  const locale = resolvePreferredPublicLocale((await headers()).get("accept-language"));
  permanentRedirect(`/${locale}/pandas` as Route);
}
