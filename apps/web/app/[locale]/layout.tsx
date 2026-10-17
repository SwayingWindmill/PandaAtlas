import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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

  return (
    <div lang={publicLanguageTag(locale)} className="pa-public-register">
      <QueryProvider>{children}</QueryProvider>
    </div>
  );
}
