import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { buildGamePandas } from "@/features/games/game-panda";
import { RandomPandaGame } from "@/features/games/random-panda-game";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface RandomPandaPageProps {
  params: Promise<{ locale: string }>;
}

const copy = {
  zh: {
    title: "随机熊猫 | 吱熊猫",
    description: "随机遇见一只已发布的大熊猫，再继续查看 TA 的资料、家族和生活地点。",
    eyebrow: "熊猫游戏 · Random Panda",
    heading: "今天认识哪只熊猫？",
    body: "每次点一下，都从当前已发布熊猫中换一只。这里没有胜负，只负责把你带到下一只熊猫。",
    back: "返回熊猫游戏",
  },
  en: {
    title: "Random Panda | ZhiPanda",
    description: "Meet one published panda at random, then continue into its profile, family, and places.",
    eyebrow: "Panda games · Random Panda",
    heading: "Which panda will you meet today?",
    body: "Each tap picks another panda from the current published set. There is no score—only another panda to meet.",
    back: "Back to panda games",
  },
} as const;

export async function generateMetadata({ params }: RandomPandaPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/games/random",
  });
}

export default async function RandomPandaPage({ params }: RandomPandaPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const alternateLocale = locale === "zh" ? "en" : "zh";
  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();
  const pandas = buildGamePandas(envelope.data.pandas, locale);
  const t = copy[locale];

  return (
    <>
      <GlobalNavigation
        locale={locale}
        active="games"
        alternatePath={`/${alternateLocale}/games/random`}
      />
      <main id="main-content" className="bg-[var(--bg)] text-[var(--fg)]">
        <div className={`${publicShellClassName} grid gap-8 py-10 sm:py-14`}>
          <header className="max-w-3xl">
            <p className="text-sm font-semibold text-[var(--accent)]">{t.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-semibold sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>{t.heading}</h1>
            <p className="mt-4 text-base leading-8 text-[var(--muted)]">{t.body}</p>
            <Link href={`/${locale}/games` as Route} className="mt-5 inline-flex font-semibold text-[var(--accent)] underline underline-offset-4">
              {t.back}
            </Link>
          </header>
          <RandomPandaGame locale={locale} pandas={pandas} />
        </div>
      </main>
    </>
  );
}
