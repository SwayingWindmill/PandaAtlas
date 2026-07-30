import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { isFeedUiEnabled } from "@/features/feed/config";
import { loadPersonalizedFeed } from "@/features/feed/feed-api";
import { PersonalizedFeedPage } from "@/features/feed/personalized-feed-page";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LocalizedFeedPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

const metadataCopy = {
  zh: {
    title: "我的熊猫动态 | 吱熊猫",
    description: "按发布时间查看你关注的大熊猫动态。此页面仅对当前账号可见，不会建立公开主页或排名。",
  },
  en: {
    title: "My panda updates | ZhiPanda",
    description: "See published updates from the pandas you follow. This page is private to your account and never creates a public profile or ranking.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedFeedPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/me/feed",
    privatePage: true,
    noFollow: true,
  });
}

export default async function LocalizedFeedPage({
  params,
  searchParams,
}: LocalizedFeedPageProps) {
  await connection();
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale || !isFeedUiEnabled()) notFound();

  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    redirect(`/auth/login?next=${encodeURIComponent(`/${locale}/me/feed`)}`);
  }
  const { cursor } = await searchParams;
  const result = await loadPersonalizedFeed(accessToken, cursor);
  if (result.state === "unauthenticated") {
    redirect(`/auth/login?next=${encodeURIComponent(`/${locale}/me/feed`)}&reason=session-expired`);
  }
  if (result.state === "disabled") notFound();

  const atlas = loadPublishedAtlasDataset(locale);
  return (
    <PersonalizedFeedPage
      locale={locale}
      state={result.state}
      page={result.state === "ready" ? result.page : undefined}
      pandas={atlas.data.pandas}
    />
  );
}
