"use client";

import type { Route } from "next";
import Link from "next/link";
import { BookOpen, LogIn } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { pandaBookQueryOptions } from "@/features/fan/api/queries";
import { privateReadStatus, signInHref, useFanSession } from "@/features/fan/api/session";
import type { PandaBookEntry } from "@/features/fan/api/types";
import type { PublicLocale } from "@/foundation/content/locales";

export interface PandaBookPanda {
  id: string;
  name: string;
  alternateName: string | null;
  href: string;
  imageUrl: string | null;
  imageAlt: string;
}

const copy = {
  zh: {
    eyebrow: "我的熊猫 · 图鉴",
    title: "熊猫图鉴",
    body: "在小游戏里认识的熊猫会收进这里。这里只有你自己的进度，没有排行榜。",
    progress: (known: number, total: number) => `已认识 ${known} / ${total} 只`,
    progressLabel: "图鉴进度",
    empty: "图鉴里还没有熊猫",
    emptyBody: "玩一局每日一猫或猜熊猫，保存结果后，那只熊猫就会收进图鉴。",
    daily: "玩每日一猫",
    guess: "玩猜熊猫",
    signIn: "登录后查看你的熊猫图鉴，网站和 App 同步。",
    signInAction: "登录",
    loading: "正在打开图鉴……",
    unavailable: "图鉴暂时无法读取。",
    met: (date: string, game: PandaBookEntry["firstGame"]) =>
      `${date} 在${game === "daily_panda" ? "每日一猫" : "猜熊猫"}里认识`,
    timesMet: (count: number) => `遇到过 ${count} 次`,
  },
  en: {
    eyebrow: "My Pandas · Panda book",
    title: "Panda book",
    body: "Pandas you meet in the games are collected here. It shows your own progress only; there is no leaderboard.",
    progress: (known: number, total: number) => `${known} of ${total} pandas met`,
    progressLabel: "Panda book progress",
    empty: "No pandas in your book yet",
    emptyBody: "Play Daily Panda or Guess Panda and save the result to add that panda to your book.",
    daily: "Play Daily Panda",
    guess: "Play Guess Panda",
    signIn: "Sign in to see your panda book, synced between the website and the app.",
    signInAction: "Sign in",
    loading: "Opening your panda book…",
    unavailable: "Your panda book is temporarily unavailable.",
    met: (date: string, game: PandaBookEntry["firstGame"]) =>
      `Met on ${date} in ${game === "daily_panda" ? "Daily Panda" : "Guess Panda"}`,
    timesMet: (count: number) => `Met ${count} times`,
  },
} as const;

export function PandaBookPage({ locale, pandas }: { locale: PublicLocale; pandas: PandaBookPanda[] }) {
  const session = useFanSession();
  const book = useQuery({ ...pandaBookQueryOptions, enabled: session.status === "ready" });
  const pandaById = useMemo(() => new Map(pandas.map((panda) => [panda.id, panda])), [pandas]);
  const t = copy[locale];
  const status = privateReadStatus(session.status, book);
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(locale === "zh" ? "zh-CN" : "en", { year: "numeric", month: "short", day: "numeric" });

  if (status === "loading") {
    return <p className="py-12 text-sm text-[var(--muted)]" role="status">{t.loading}</p>;
  }

  if (status === "signed-out") {
    return (
      <section className="my-10 rounded-2xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-6 sm:p-8">
        <LogIn aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold">{t.signIn}</p>
        <Link href={signInHref(`/${locale}/me/panda-book`) as Route} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white">
          {t.signInAction}
        </Link>
      </section>
    );
  }

  if (status !== "ready" || book.data === undefined) {
    return <p className="my-10 rounded-xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-5" role="alert">{t.unavailable}</p>;
  }

  const { knownCount, publishedCount, items } = book.data;
  // Not rounded, so the first few pandas still show on the bar.
  const percent = publishedCount === 0 ? 0 : (knownCount / publishedCount) * 100;
  const gameLinks = (
    <div className="flex flex-wrap gap-3">
      <Link href={`/${locale}/games/daily` as Route} className="inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white">
        {t.daily}
      </Link>
      <Link href={`/${locale}/games/guess` as Route} className="inline-flex min-h-12 items-center rounded-xl border border-[var(--pa-color-accent-border-14)] px-5 py-3 font-semibold">
        {t.guess}
      </Link>
    </div>
  );

  return (
    <div className="grid gap-9 py-10 sm:py-14">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><BookOpen className="h-4 w-4" aria-hidden="true" />{t.eyebrow}</div>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>{t.title}</h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">{t.body}</p>
        <div className="mt-6 grid max-w-md gap-2">
          <p className="font-semibold" id="panda-book-progress">{t.progress(knownCount, publishedCount)}</p>
          <Progress value={percent} aria-labelledby="panda-book-progress" />
        </div>
      </header>

      {items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t.title}>
          {items.map((entry) => {
            const panda = pandaById.get(entry.pandaId);
            if (!panda) return null;
            return (
              <li key={entry.pandaId}>
                <Link href={panda.href as Route} className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                  <Card className="h-full gap-4 overflow-hidden pt-0">
                    {panda.imageUrl ? (
                      <div
                        role="img"
                        aria-label={panda.imageAlt}
                        className="aspect-[4/3] bg-[var(--pa-color-accent-border-10)] bg-cover bg-center"
                        style={{ backgroundImage: `url(${JSON.stringify(panda.imageUrl)})` }}
                      />
                    ) : (
                      <div className="aspect-[4/3] bg-[var(--pa-color-accent-border-10)]" aria-hidden="true" />
                    )}
                    <CardHeader>
                      <CardTitle className="text-lg">{panda.name}</CardTitle>
                      {panda.alternateName ? <CardDescription>{panda.alternateName}</CardDescription> : null}
                    </CardHeader>
                    <CardContent className="grid gap-1 text-sm text-[var(--muted)]">
                      <p>{t.met(formatDate(entry.firstMetAt), entry.firstGame)}</p>
                      {entry.timesMet > 1 ? <p>{t.timesMet(entry.timesMet)}</p> : null}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty className="border border-dashed border-[var(--pa-color-accent-border-18)]">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BookOpen aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>{t.empty}</EmptyTitle>
            <EmptyDescription>{t.emptyBody}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{gameLinks}</EmptyContent>
        </Empty>
      )}

      {items.length ? gameLinks : null}
    </div>
  );
}
