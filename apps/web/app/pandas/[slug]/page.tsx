import type { Route } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";

import { resolvePublishedPandaReference } from "@/features/public-content/public-release";
import { resolvePreferredPublicLocale } from "@/foundation/content/locales";

interface UnlocalizedPandaPageProps {
  params: Promise<{ slug: string }>;
}

export default async function UnlocalizedPandaPage({ params }: UnlocalizedPandaPageProps) {
  const { slug } = await params;
  const reference = resolvePublishedPandaReference(slug);
  if (!reference) notFound();
  const locale = resolvePreferredPublicLocale((await headers()).get("accept-language"));
  permanentRedirect(`/${locale}/pandas/${reference.slug}` as Route);
}
