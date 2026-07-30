import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import { ContributionEditor } from "@/features/contribute/contribution-editor";
import { isCommunityIntakeUiEnabled } from "@/features/contribute/config";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ContributionPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "提交纠错与资料 | 吱熊猫",
    description: "向吱熊猫提交有来源的纠错或资料补充。提交内容仅对你和审核人员可见，审核后才可能公开。",
  },
  en: {
    title: "Submit a correction or source | ZhiPanda",
    description: "Send ZhiPanda a sourced correction or information update. It stays private during review and is never published automatically.",
  },
} as const;

export async function generateMetadata({ params }: ContributionPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const copy = metadataCopy[locale];
  return buildPublicMetadata({
    locale,
    title: copy.title,
    description: copy.description,
    path: "/contribute",
    privatePage: true,
    noFollow: true,
  });
}

export default async function ContributionPage({ params }: ContributionPageProps) {
  await connection();
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale || !isCommunityIntakeUiEnabled()) notFound();

  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    redirect(`/auth/login?next=${encodeURIComponent(`/${locale}/contribute`)}`);
  }
  const alternate = locale === "zh" ? "en" : "zh";
  return (
    <div className="contribution-page">
      <GlobalNavigation
        locale={locale}
        active="contribute"
        alternatePath={`/${alternate}/contribute`}
      />
      <main id="main-content" className="contribution-shell">
        <ContributionEditor locale={locale} />
      </main>
    </div>
  );
}
