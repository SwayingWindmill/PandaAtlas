import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import { MyAppeals } from "@/features/moderation/my-appeals";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AppealsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AppealsPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  return buildPublicMetadata({
    locale,
    title: locale === "zh" ? "我的申诉 | 吱熊猫" : "My appeals | ZhiPanda",
    description:
      locale === "zh"
        ? "查看当前账号的限制记录并提交或跟踪申诉。"
        : "Review restrictions for your account and submit or track an appeal.",
    path: "/me/appeals",
    privatePage: true,
    noFollow: true,
  });
}

export default async function AppealsPage({ params }: AppealsPageProps) {
  await connection();
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) redirect("/zh/me/appeals");

  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    redirect(`/auth/login?next=${encodeURIComponent(`/${locale}/me/appeals`)}`);
  }

  const alternate = locale === "zh" ? "en" : "zh";
  return (
    <div className="min-h-screen bg-stone-50">
      <GlobalNavigation
        locale={locale}
        active="my-pandas"
        alternatePath={`/${alternate}/me/appeals`}
      />
      <main id="main-content">
        <MyAppeals locale={locale} />
      </main>
    </div>
  );
}
