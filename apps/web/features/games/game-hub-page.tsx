import type { Route } from "next";
import Link from "next/link";
import { Dices, FileQuestion, Sparkles } from "lucide-react";

import type { PublicLocale } from "@/foundation/content/locales";

const copy = {
  zh: {
    eyebrow: "熊猫游戏",
    title: "轻松玩一会儿，也认识一只新熊猫。",
    body: "游戏直接使用吱熊猫已经发布的熊猫资料和公开图片。第一版不需要登录，也不保存成绩。",
    randomTitle: "随机熊猫",
    randomBody: "随机遇见一只熊猫，从名字、照片和现在地点开始认识 TA。",
    randomAction: "随机一只",
    guessTitle: "猜熊猫",
    guessBody: "只看公开照片做四选一，答完马上揭晓是哪只熊猫。",
    guessAction: "开始猜",
    note: "没有排行榜，没有每日任务，也不会因为玩游戏自动收藏熊猫。",
  },
  en: {
    eyebrow: "Panda games",
    title: "Play for a moment and meet another panda.",
    body: "These games use ZhiPanda's published panda information and public media. The first version requires no sign-in and stores no score.",
    randomTitle: "Random Panda",
    randomBody: "Meet one panda at random, starting with its name, photo, and current place.",
    randomAction: "Pick a panda",
    guessTitle: "Guess Panda",
    guessBody: "Identify a panda from a published photo, then reveal the answer immediately.",
    guessAction: "Start guessing",
    note: "No leaderboard, no daily-task system, and playing never favorites a panda automatically.",
  },
} as const;

export function GameHubPage({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  return (
    <div className="grid gap-10 py-10 sm:py-14">
      <header className="max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--pa-color-accent-border-14)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--accent)]">
          <Sparkles className="h-4 w-4" aria-hidden="true" />{t.eyebrow}
        </div>
        <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
          {t.title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] sm:text-lg">{t.body}</p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <GameCard
          href={`/${locale}/games/random`}
          icon={<Dices className="h-6 w-6" aria-hidden="true" />}
          title={t.randomTitle}
          body={t.randomBody}
          action={t.randomAction}
        />
        <GameCard
          href={`/${locale}/games/guess`}
          icon={<FileQuestion className="h-6 w-6" aria-hidden="true" />}
          title={t.guessTitle}
          body={t.guessBody}
          action={t.guessAction}
        />
      </div>

      <p className="max-w-3xl rounded-2xl bg-[var(--surface-muted)] p-5 text-sm leading-7 text-[var(--muted)]">{t.note}</p>
    </div>
  );
}

function GameCard({
  href,
  icon,
  title,
  body,
  action,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  action: string;
}) {
  return (
    <article className="flex min-h-72 flex-col rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-8">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)]">{icon}</span>
      <h2 className="mt-7 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
      <p className="mt-3 flex-1 text-sm leading-7 text-[var(--muted)]">{body}</p>
      <Link href={href as Route} className="mt-8 inline-flex min-h-12 items-center self-start rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white">
        {action}
      </Link>
    </article>
  );
}
