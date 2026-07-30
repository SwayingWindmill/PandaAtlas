import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import { ContributionEditor } from "@/features/contribute/contribution-editor";
import { isCommunityIntakeUiEnabled } from "@/features/contribute/config";
import { parsePublicLocale } from "@/foundation/content/locales";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ContributionPageProps {
  params: Promise<{ locale: string }>;
}

const metadataCopy = {
  zh: {
    title: "提交结构化贡献",
    description: "向吱熊猫提交私有、结构化、有来源的档案更正或信息补充。",
  },
  en: {
    title: "Submit a structured contribution",
    description: "Submit a private, structured, sourced correction or information update to ZhiPanda.",
  },
} as const;

export async function generateMetadata({ params }: ContributionPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const copy = metadataCopy[locale];
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false, nocache: true },
    alternates: {
      canonical: `/${locale}/contribute`,
      languages: {
        "zh-CN": "/zh/contribute",
        en: "/en/contribute",
        "x-default": "/zh/contribute",
      },
    },
  };
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
