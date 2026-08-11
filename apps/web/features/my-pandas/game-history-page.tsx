"use client";

import type { Route } from "next";
import Link from "next/link";
import { Gamepad2, LogIn, Trash2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

import type { PublicLocale } from "@/foundation/content/locales";

interface PandaReference {
  id: string;
  name: string;
  href: string;
}

interface GameAttempt {
  attempt_id: string;
  game_type: "guess_panda";
  target_panda_id: string;
  selected_panda_id: string;
  correct: boolean;
  public_release_version: string | null;
  attempted_at: string;
}

type PageState = "loading" | "ready" | "signed-out" | "error";

const copy = {
  zh: {
    eyebrow: "我的熊猫 · 游戏",
    title: "已保存的猜熊猫记录",
    body: "这里只有你主动保存的 Guess Panda 结果。匿名游玩不会写入账号，也没有排行榜。",
    empty: "还没有保存过游戏结果。",
    play: "去玩猜熊猫",
    signIn: "登录后查看跨设备同步的游戏历史。",
    signInAction: "登录",
    unavailable: "游戏历史暂时无法读取。",
    correct: "答对",
    wrong: "答错",
    answer: "你的答案",
    target: "正确答案",
    release: "公开版本",
    remove: "删除记录",
    unknown: "当前公开版本中没有这只熊猫",
  },
  en: {
    eyebrow: "My Pandas · Games",
    title: "Saved Guess Panda results",
    body: "Only Guess Panda results you explicitly save appear here. Anonymous play writes nothing to your account and there is no leaderboard.",
    empty: "You have not saved a game result yet.",
    play: "Play Guess Panda",
    signIn: "Sign in to view your synced game history.",
    signInAction: "Sign in",
    unavailable: "Game history is temporarily unavailable.",
    correct: "Correct",
    wrong: "Incorrect",
    answer: "Your answer",
    target: "Correct answer",
    release: "Public release",
    remove: "Delete result",
    unknown: "This panda is not in the current public release",
  },
} as const;

export function GameHistoryPage({ locale, pandas }: { locale: PublicLocale; pandas: PandaReference[] }) {
  const [state, setState] = useState<PageState>("loading");
  const [attempts, setAttempts] = useState<GameAttempt[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pandaById = useMemo(() => new Map(pandas.map((panda) => [panda.id, panda])), [pandas]);
  const t = copy[locale];

  useEffect(() => {
    let active = true;
    void fetch("/api/engagement/game-attempts", { cache: "no-store" }).then(async (response) => {
      if (!active) return;
      if (response.status === 401) {
        setState("signed-out");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }
      const payload = await response.json() as { items?: GameAttempt[] };
      if (!active) return;
      setAttempts(Array.isArray(payload.items) ? payload.items : []);
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  async function removeAttempt(attemptId: string) {
    setBusyId(attemptId);
    const response = await fetch(`/api/engagement/game-attempts/${encodeURIComponent(attemptId)}`, {
      method: "DELETE",
    });
    setBusyId(null);
    if (response.ok) {
      setAttempts((current) => current.filter((attempt) => attempt.attempt_id !== attemptId));
    }
  }

  if (state === "loading") {
    return <p className="py-12 text-sm text-[var(--muted)]" role="status">{locale === "zh" ? "正在读取游戏历史……" : "Loading game history…"}</p>;
  }

  if (state === "signed-out") {
    return (
      <section className="my-10 rounded-2xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-6 sm:p-8">
        <LogIn aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold">{t.signIn}</p>
        <Link href={`/auth/login?next=/${locale}/me/game-history` as Route} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white">
          {t.signInAction}
        </Link>
      </section>
    );
  }

  if (state === "error") {
    return <p className="my-10 rounded-xl border border-[var(--pa-color-accent-border-12)] bg-[var(--card)] p-5" role="alert">{t.unavailable}</p>;
  }

  return (
    <div className="grid gap-9 py-10 sm:py-14">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]"><Gamepad2 className="h-4 w-4" aria-hidden="true" />{t.eyebrow}</div>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>{t.title}</h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted)]">{t.body}</p>
      </header>

      {attempts.length ? (
        <ol className="grid gap-4">
          {attempts.map((attempt) => {
            const target = pandaById.get(attempt.target_panda_id);
            const selected = pandaById.get(attempt.selected_panda_id);
            return (
              <li key={attempt.attempt_id} className="rounded-2xl border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <strong className="text-lg">{attempt.correct ? t.correct : t.wrong}</strong>
                    <p className="mt-1 text-sm text-[var(--muted)]">{new Date(attempt.attempted_at).toLocaleString(locale === "zh" ? "zh-CN" : "en")}</p>
                  </div>
                  <button type="button" disabled={busyId === attempt.attempt_id} onClick={() => void removeAttempt(attempt.attempt_id)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />{t.remove}
                  </button>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="font-semibold">{t.target}</dt><dd className="mt-1 text-[var(--muted)]">{target ? <Link href={target.href as Route} className="underline underline-offset-4">{target.name}</Link> : t.unknown}</dd></div>
                  <div><dt className="font-semibold">{t.answer}</dt><dd className="mt-1 text-[var(--muted)]">{selected ? <Link href={selected.href as Route} className="underline underline-offset-4">{selected.name}</Link> : t.unknown}</dd></div>
                  {attempt.public_release_version ? <div><dt className="font-semibold">{t.release}</dt><dd className="mt-1 text-[var(--muted)]">{attempt.public_release_version}</dd></div> : null}
                </dl>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--pa-color-accent-border-18)] p-6">
          <p>{t.empty}</p>
        </div>
      )}

      <Link href={`/${locale}/games/guess` as Route} className="inline-flex min-h-12 items-center justify-self-start rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white">
        {t.play}
      </Link>
    </div>
  );
}
