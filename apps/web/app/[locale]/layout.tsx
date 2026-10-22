import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import FooterMinimal from "@/components/blocks/marketing/footers/minimal";
import { Navbar1 } from "@/components/navbar-1";
import { isCommunityIntakeUiEnabled } from "@/features/contribute/config";
import { isNotificationCenterEnabled } from "@/features/notification-center/config";
import { loadSiteNavigation } from "@/features/site-shell/site-navigation";
import { parsePublicLocale, PUBLIC_LOCALES, publicLanguageTag } from "@/foundation/content/locales";
import { QueryProvider } from "@/lib/query/provider";

interface PublicLocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((locale) => ({ locale }));
}

export default async function PublicLocaleLayout({ children, params }: PublicLocaleLayoutProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const navigation = await loadSiteNavigation(locale);

  return (
    <div lang={publicLanguageTag(locale)} className="pa-public-register">
      <a href="#main-content" className="pa-skip-link">
        {locale === "zh" ? "跳到主要内容" : "Skip to main content"}
      </a>
      <Navbar1
        locale={locale}
        searchResults={navigation.searchResults}
        featuredPandas={navigation.featuredPandas}
        contributeEnabled={isCommunityIntakeUiEnabled()}
        notificationsEnabled={isNotificationCenterEnabled()}
      />
      <QueryProvider>{children}</QueryProvider>
      <FooterMinimal locale={locale} />
    </div>
  );
}
