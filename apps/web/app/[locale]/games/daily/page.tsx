import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { publicShellClassName } from "@/components/patterns/public-shell";
import { DailyPandaGame } from "@/features/games/daily-panda-game";
import { buildGamePandas } from "@/features/games/game-panda";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface DailyPandaPageProps {
  params: Promise<{ locale: string }>;
}

const copy = {
  zh: {
    title: "每日一猫 | 吱熊猫",
    description: "每天一只已发布的大熊猫，根据线索把 TA 猜出来。",
    eyebrow: "熊猫游戏 · 每日一猫",
    heading: "今天是哪只熊猫？",
    body: "每天所有人猜同一只熊猫。最多 6 次机会，每猜错一次多揭开一条线索。线索都来自已发布的资料。",
    back: "返回熊猫游戏",
  },
  en: {
    title: "Daily Panda | ZhiPanda",
    description: "One published panda a day. Work out who it is from the clues.",
    eyebrow: "Panda games · Daily Panda",
    heading: "Which panda is it today?",
    body: "Everyone guesses the same panda each day. You have six guesses, and each wrong guess reveals another clue. Every clue comes from published information.",
    back: "Back to panda games",
  },
} as const;

export async function generateMetadata({ params }: DailyPandaPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({ locale, title: t.title, description: t.description, path: "/games/daily" });
}

export default async function DailyPandaPage({ params }: DailyPandaPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();
  const pandas = buildGamePandas(envelope.data.pandas, locale).map(({ id, slug, name, alternateName }) => ({
    id,
    slug,
    name,
    alternateName,
  }));
  const t = copy[locale];

  return (
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
        <DailyPandaGame locale={locale} pandas={pandas} />
      </div>
    </main>
  );
}
