import type { Route } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";

import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";

export const dynamic = "force-dynamic";

interface RandomPandaPageProps {
  params: Promise<{ locale: string }>;
}

// "Meet one at random" is a button, not a page: each visit lands on a different profile.
export default async function RandomPandaPage({ params }: RandomPandaPageProps) {
  await connection();
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const envelope = await loadV2PublicAtlasDataset(locale);
  const pandas = envelope?.data.pandas ?? [];
  if (!pandas.length) redirect(`/${locale}/pandas` as Route);
  const panda = pandas[Math.floor(Math.random() * pandas.length)];
  redirect(`/${locale}/pandas/${panda.slug}` as Route);
}
