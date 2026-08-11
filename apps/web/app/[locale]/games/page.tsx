import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { GameHubPage } from "@/features/games/game-hub-page";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface GamesPageProps {
  params: Promise<{ locale: string }>;
}

const copy = {
  zh: {
    title: "熊猫游戏 | 吱熊猫",
    description: "玩随机熊猫和猜熊猫，从已发布资料中轻松认识更多大熊猫。",
  },
  en: {
    title: "Panda games | ZhiPanda",
    description: "Play Random Panda and Guess Panda using ZhiPanda's published panda information.",
  },
} as const;

export async function generateMetadata({ params }: GamesPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({ locale, title: t.title, description: t.description, path: "/games" });
}

export default async function GamesPage({ params }: GamesPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const alternateLocale = locale === "zh" ? "en" : "zh";

  return (
    <>
      <GlobalNavigation locale={locale} active="games" alternatePath={`/${alternateLocale}/games`} />
      <main id="main-content" className="bg-[var(--bg)] text-[var(--fg)]">
        <div className={publicShellClassName}>
          <GameHubPage locale={locale} />
        </div>
      </main>
    </>
  );
}
