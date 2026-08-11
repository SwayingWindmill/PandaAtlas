import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { GameHistoryPage } from "@/features/my-pandas/game-history-page";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface GameHistoryRouteProps {
  params: Promise<{ locale: string }>;
}

const copy = {
  zh: {
    title: "游戏历史 | 我的熊猫 | 吱熊猫",
    description: "查看你主动保存的 Guess Panda 游戏结果。",
  },
  en: {
    title: "Game history | My Pandas | ZhiPanda",
    description: "Review Guess Panda results you explicitly saved to your account.",
  },
} as const;

export async function generateMetadata({ params }: GameHistoryRouteProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/me/game-history",
    privatePage: true,
  });
}

export default async function GameHistoryRoute({ params }: GameHistoryRouteProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const envelope = loadPublishedAtlasDataset(locale);
  const alternateLocale = locale === "zh" ? "en" : "zh";
  const pandas = envelope.data.pandas.map((panda) => ({
    id: panda.id,
    name: locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh,
    href: `/${locale}/pandas/${panda.slug}`,
  }));

  return (
    <>
      <GlobalNavigation
        locale={locale}
        active="my-pandas"
        alternatePath={`/${alternateLocale}/me/game-history`}
      />
      <main id="main-content" className="bg-[var(--bg)] text-[var(--fg)]">
        <div className={publicShellClassName}>
          <GameHistoryPage locale={locale} pandas={pandas} />
        </div>
      </main>
    </>
  );
}
