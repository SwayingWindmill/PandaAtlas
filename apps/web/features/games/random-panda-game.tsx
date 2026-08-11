"use client";

import type { Route } from "next";
import Link from "next/link";
import { Dices, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import type { PublicLocale } from "@/foundation/content/locales";
import type { GamePanda } from "@/features/games/game-panda";

const copy = {
  zh: {
    eyebrow: "随机熊猫",
    title: "今天认识哪只熊猫？",
    body: "点一下随机抽一只熊猫。没有分数，也不需要登录，只是轻松认识下一只。",
    action: "再来一只",
    open: "打开熊猫资料",
    noPhoto: "这只熊猫暂时没有公开照片",
    born: "出生年份",
    place: "现在地点",
  },
  en: {
    eyebrow: "Random Panda",
    title: "Which panda will you meet today?",
    body: "Pick a panda at random. No score and no sign-in—just an easy way to meet the next panda.",
    action: "Pick another panda",
    open: "Open panda profile",
    noPhoto: "No published photo is available for this panda yet",
    born: "Born",
    place: "Current place",
  },
} as const;

function randomIndex(length: number, previous: number): number {
  if (length <= 1) return 0;
  let next = previous;
  while (next === previous) next = Math.floor(Math.random() * length);
  return next;
}

export function RandomPandaGame({ locale, pandas }: { locale: PublicLocale; pandas: GamePanda[] }) {
  const [index, setIndex] = useState(0);
  const available = useMemo(() => pandas.filter((panda) => panda.name), [pandas]);
  const panda = available[index] ?? available[0];
  const t = copy[locale];

  if (!panda) return null;

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)] lg:items-stretch">
      <div className="overflow-hidden rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)]">
        {panda.imageUrl ? (
          <div
            role="img"
            aria-label={panda.imageAlt}
            className="min-h-[24rem] bg-cover bg-center sm:min-h-[34rem]"
            style={{ backgroundImage: `url(${JSON.stringify(panda.imageUrl)})` }}
          />
        ) : (
          <div className="grid min-h-[24rem] place-items-center bg-[var(--surface-muted)] p-8 text-center text-[var(--muted)] sm:min-h-[34rem]">
            {t.noPhoto}
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-8">
        <p className="text-sm font-semibold text-[var(--accent)]">{t.eyebrow}</p>
        <h2 className="mt-3 text-4xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{panda.name}</h2>
        {panda.alternateName ? <p className="mt-2 text-sm text-[var(--muted)]">{panda.alternateName}</p> : null}
        <dl className="mt-6 grid gap-3 text-sm">
          {panda.birthYear ? <div><dt className="font-semibold">{t.born}</dt><dd className="mt-1 text-[var(--muted)]">{panda.birthYear}</dd></div> : null}
          {panda.currentLocation ? <div><dt className="font-semibold">{t.place}</dt><dd className="mt-1 text-[var(--muted)]">{panda.currentLocation}</dd></div> : null}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIndex((current) => randomIndex(available.length, current))}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
          >
            <Dices className="h-4 w-4" aria-hidden="true" />{t.action}
          </button>
          <Link
            href={`/${locale}/pandas/${panda.slug}` as Route}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--pa-color-accent-border-14)] px-5 py-3 font-semibold"
          >
            {t.open}<ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
