import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { isFeedUiEnabled } from "@/features/feed/config";
import { loadPersonalizedFeed } from "@/features/feed/feed-api";
import { PersonalizedFeedPage } from "@/features/feed/personalized-feed-page";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface LocalizedFeedPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string }>;
}

const metadataCopy = {
  zh: {
    title: "我的关注动态 | 私有熊猫 Feed",
    description: "查看当前账号关注熊猫的时间顺序动态；页面不建立公开用户主页或排名。",
  },
  en: {
    title: "My Follow Activity | Private panda Feed",
    description: "Read chronological Activity for pandas followed by the current account, without a public user profile or ranking.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedFeedPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = metadataCopy[locale];
  return {
    title: t.title,
    description: t.description,
    robots: { index: false, follow: false, nocache: true },
    alternates: {
      canonical: `/${locale}/me/feed`,
      languages: {
        "zh-CN": "/zh/me/feed",
        en: "/en/me/feed",
        "x-default": "/zh/me/feed",
      },
    },
  };
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
