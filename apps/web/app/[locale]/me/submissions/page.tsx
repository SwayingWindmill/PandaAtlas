import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import { isCommunityIntakeUiEnabled } from "@/features/contribute/config";
import { SubmissionDashboard } from "@/features/contribute/submission-dashboard";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SubmissionPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: SubmissionPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  return buildPublicMetadata({
    locale,
    title: locale === "zh" ? "我的提交 | 吱熊猫" : "My submissions | ZhiPanda",
    description: locale === "zh"
      ? "查看当前账号的私有贡献草稿、修订和审核状态。"
      : "Review private contribution drafts, revisions, and review status for your ZhiPanda account.",
    path: "/me/submissions",
    privatePage: true,
    noFollow: true,
  });
}

export default async function SubmissionPage({ params }: SubmissionPageProps) {
  await connection();
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale || !isCommunityIntakeUiEnabled()) notFound();

  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    redirect(`/auth/login?next=${encodeURIComponent(`/${locale}/me/submissions`)}`);
  }
  const alternate = locale === "zh" ? "en" : "zh";
  return (
    <div className="contribution-page">
      <GlobalNavigation
        locale={locale}
        active="contribute"
        alternatePath={`/${alternate}/me/submissions`}
      />
      <main id="main-content" className="contribution-shell">
        <SubmissionDashboard locale={locale} />
      </main>
    </div>
  );
}
