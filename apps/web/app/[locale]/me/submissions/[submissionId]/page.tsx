import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import { isCommunityIntakeUiEnabled } from "@/features/contribute/config";
import { ContributionEditor } from "@/features/contribute/contribution-editor";
import { parsePublicLocale } from "@/foundation/content/locales";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SubmissionDetailPageProps {
  params: Promise<{ locale: string; submissionId: string }>;
}

export async function generateMetadata({ params }: SubmissionDetailPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  return {
    title: locale === "zh" ? "提交详情" : "Submission details",
    description:
      locale === "zh"
        ? "查看私有提交的状态、修订和证据扫描状态。"
        : "Review private submission status, revisions, and evidence scan states.",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function SubmissionDetailPage({ params }: SubmissionDetailPageProps) {
  await connection();
  const { locale: rawLocale, submissionId } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale || !isCommunityIntakeUiEnabled()) notFound();

  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/${locale}/me/submissions/${submissionId}`)}`,
    );
  }
  const alternate = locale === "zh" ? "en" : "zh";
  return (
    <div className="contribution-page">
      <GlobalNavigation
        locale={locale}
        active="contribute"
        alternatePath={`/${alternate}/me/submissions/${submissionId}`}
      />
      <main id="main-content" className="contribution-shell">
        <ContributionEditor locale={locale} submissionId={submissionId} />
      </main>
    </div>
  );
}
