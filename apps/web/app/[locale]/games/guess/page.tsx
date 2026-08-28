import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { GuessPandaGame } from "@/features/games/guess-panda-game";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface GuessPandaPageProps {
  params: Promise<{ locale: string }>;
}

const copy = {
  zh: {
    title: "猜熊猫 | 吱熊猫",
    description: "通过已发布的大熊猫公开照片玩四选一猜熊猫。",
    eyebrow: "熊猫游戏 · Guess Panda",
    heading: "你能认出照片里的熊猫吗？",
    body: "每题都来自当前公开熊猫资料。答案揭晓后可以直接进入资料页继续认识 TA。",
    back: "返回熊猫游戏",
  },
  en: {
    title: "Guess Panda | ZhiPanda",
    description: "Play a four-choice panda identification game using published panda photos.",
    eyebrow: "Panda games · Guess Panda",
    heading: "Can you recognize the panda in the photo?",
    body: "Every round comes from the current published panda set. After revealing the answer, continue into the profile.",
    back: "Back to panda games",
  },
} as const;

export async function generateMetadata({ params }: GuessPandaPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({
    locale,
    title: t.title,
    description: t.description,
    path: "/games/guess",
  });
}

export default async function GuessPandaPage({ params }: GuessPandaPageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const alternateLocale = locale === "zh" ? "en" : "zh";
  const t = copy[locale];

  return (
    <>
      <GlobalNavigation
        locale={locale}
        active="games"
        alternatePath={`/${alternateLocale}/games/guess`}
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
          <GuessPandaGame locale={locale} />
        </div>
      </main>
    </>
  );
}
