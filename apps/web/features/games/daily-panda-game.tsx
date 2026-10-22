"use client";

import type { Route } from "next";
import Link from "next/link";
import { Check, Copy, Lock, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { fanMutationOptions } from "@/features/fan/api/queries";
import type { DailyPandaGuessFeedback, DailyPandaGuessResult, DailyPandaPuzzle } from "@/features/fan/api/types";
import type { DailyPandaClue } from "@/features/games/daily-panda-clues";
import type { PublicLocale } from "@/foundation/content/locales";

export interface DailyPandaOption {
  id: string;
  slug: string;
  name: string;
  alternateName: string | null;
}

// Today's guesses stay in this browser so a reload resumes the puzzle.
const storageKey = (puzzleDate: string) => `zhipanda:daily-panda:${puzzleDate}`;

function readStoredGuesses(puzzleDate: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(puzzleDate)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function storeGuesses(puzzleDate: string, guesses: readonly string[]) {
  try {
    window.localStorage.setItem(storageKey(puzzleDate), JSON.stringify(guesses));
  } catch {
    // Storage can be unavailable (private windows); the puzzle still plays without resuming.
  }
}

const copy = {
  zh: {
    loading: "正在准备今天的熊猫…",
    unavailable: "今天的每日一猫暂时不可用，请稍后再来。",
    retry: "重试",
    date: (date: string) => `${date} 的熊猫`,
    guessesLeft: (left: number) => `还能猜 ${left} 次`,
    locked: "猜错一次解锁",
    search: "输入熊猫名字",
    noMatch: "没有找到这只熊猫",
    searchLabel: "猜一只熊猫",
    yourGuesses: "你猜过的",
    sameSex: "性别相同",
    otherSex: "性别不同",
    earlier: "TA 出生更早",
    later: "TA 出生更晚",
    sameYear: "同年出生",
    solved: (count: number) => `猜对了！用了 ${count} 次。`,
    failed: "这次没猜出来。",
    answerIs: (name: string) => `今天的熊猫是${name}。`,
    open: "打开熊猫资料",
    share: "复制结果",
    copied: "已复制",
    shareTitle: "吱熊猫 每日一猫",
    comeBack: "明天 0 点（北京时间）换一只新熊猫。",
    clue: {
      sex: (value: "female" | "male") => `性别：${value === "female" ? "雌性" : "雄性"}`,
      birth_year: (value: number) => `出生于 ${value} 年`,
      life_status: (value: "alive" | "deceased") => (value === "alive" ? "目前在世" : "已经离世"),
      birthplace: (value: string) => `出生地：${value}`,
      name_initial: (value: string) => `名字的第一个字：${value}`,
      photo: "TA 的公开照片",
    },
    guessError: "这次没能提交，请再试一次。",
  },
  en: {
    loading: "Getting today's panda ready…",
    unavailable: "Today's Daily Panda is not available right now. Please come back later.",
    retry: "Try again",
    date: (date: string) => `Panda for ${date}`,
    guessesLeft: (left: number) => `${left} ${left === 1 ? "guess" : "guesses"} left`,
    locked: "Unlocks after a wrong guess",
    search: "Type a panda's name",
    noMatch: "No panda by that name",
    searchLabel: "Guess a panda",
    yourGuesses: "Your guesses",
    sameSex: "Same sex",
    otherSex: "Different sex",
    earlier: "Born earlier",
    later: "Born later",
    sameYear: "Born the same year",
    solved: (count: number) => `Solved in ${count} ${count === 1 ? "guess" : "guesses"}!`,
    failed: "Not this time.",
    answerIs: (name: string) => `Today's panda is ${name}.`,
    open: "Open panda profile",
    share: "Copy result",
    copied: "Copied",
    shareTitle: "ZhiPanda Daily Panda",
    comeBack: "A new panda arrives at midnight Beijing time.",
    clue: {
      sex: (value: "female" | "male") => `Sex: ${value}`,
      birth_year: (value: number) => `Born in ${value}`,
      life_status: (value: "alive" | "deceased") => (value === "alive" ? "Still alive" : "No longer alive"),
      birthplace: (value: string) => `Birthplace: ${value}`,
      name_initial: (value: string) => `First character of the Chinese name: ${value}`,
      photo: "A published photo of this panda",
    },
    guessError: "That guess could not be sent. Please try again.",
  },
} as const;

type Copy = (typeof copy)[PublicLocale];

function clueText(clue: Exclude<DailyPandaClue, { kind: "photo" }>, t: Copy): string {
  switch (clue.kind) {
    case "sex":
      return t.clue.sex(clue.value);
    case "birth_year":
      return t.clue.birth_year(clue.value);
    case "life_status":
      return t.clue.life_status(clue.value);
    case "birthplace":
      return t.clue.birthplace(clue.value);
    case "name_initial":
      return t.clue.name_initial(clue.value);
  }
}

function feedbackText(feedback: DailyPandaGuessFeedback, t: Copy): string[] {
  const parts: string[] = [];
  if (feedback.sameSex !== null) parts.push(feedback.sameSex ? t.sameSex : t.otherSex);
  if (feedback.birthYear === "answer_earlier") parts.push(t.earlier);
  if (feedback.birthYear === "answer_later") parts.push(t.later);
  if (feedback.birthYear === "same") parts.push(t.sameYear);
  return parts;
}

export function DailyPandaGame({ locale, pandas }: { locale: PublicLocale; pandas: DailyPandaOption[] }) {
  const t = copy[locale];
  const [puzzle, setPuzzle] = useState<DailyPandaPuzzle | null>(null);
  const [result, setResult] = useState<DailyPandaGuessResult | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const pandasById = useMemo(() => new Map(pandas.map((panda) => [panda.id, panda])), [pandas]);

  const guess = useMutation({
    ...fanMutationOptions.guessDailyPanda(),
    onSuccess: (received) => {
      setResult(received);
      storeGuesses(received.puzzleDate, received.guesses.map((item) => item.pandaId));
    },
  });
  const { mutate: submitGuesses } = guess;
  const load = useMutation({
    ...fanMutationOptions.getDailyPanda(),
    onSuccess: (received) => {
      setPuzzle(received);
      const stored = readStoredGuesses(received.puzzleDate);
      if (stored.length > 0) submitGuesses(stored);
    },
  });
  const { mutate: loadPuzzle } = load;

  useEffect(() => loadPuzzle(), [loadPuzzle]);

  if (!puzzle) {
    return (
      <section className="rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-10">
        {load.isError ? (
          <>
            <p role="alert">{t.unavailable}</p>
            <button
              type="button"
              onClick={() => loadPuzzle()}
              className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
            >
              {t.retry}
            </button>
          </>
        ) : (
          <p role="status" className="text-[var(--muted)]">{t.loading}</p>
        )}
      </section>
    );
  }

  const guesses = result?.guesses ?? [];
  const clues = result?.clues ?? puzzle.clues;
  const finished = result?.finished ?? false;
  const guessedIds = new Set(guesses.map((item) => item.pandaId));
  const left = puzzle.maxGuesses - guesses.length;
  const answer = result?.answer ? pandasById.get(result.answer.pandaId) : undefined;

  function choose(pandaId: string) {
    if (finished || guess.isPending || guessedIds.has(pandaId)) return;
    setSearch("");
    submitGuesses([...guesses.map((item) => item.pandaId), pandaId]);
  }

  async function shareResult() {
    const marks = guesses.map((item) => (item.correct ? "🟩" : "🟥")).join("");
    const score = result?.solved ? `${guesses.length}/${puzzle!.maxGuesses}` : `X/${puzzle!.maxGuesses}`;
    try {
      await navigator.clipboard.writeText(`${t.shareTitle} ${puzzle!.puzzleDate} ${score}\n${marks}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)] lg:items-start">
      <div className="rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold">{t.date(puzzle.puzzleDate)}</h2>
          {!finished ? <span className="text-sm text-[var(--muted)]">{t.guessesLeft(left)}</span> : null}
        </div>
        <ol className="mt-6 grid gap-3">
          {Array.from({ length: puzzle.clueCount }, (_, index) => {
            const clue = clues[index];
            if (clue === undefined) {
              return (
                <li key={index} className="flex min-h-12 items-center gap-3 rounded-xl border border-dashed border-[var(--pa-color-accent-border-14)] px-4 py-3 text-sm text-[var(--muted)]">
                  <Lock className="h-4 w-4" aria-hidden="true" />{t.locked}
                </li>
              );
            }
            if (clue.kind === "photo") {
              return (
                <li key={index} className="overflow-hidden rounded-xl border border-[var(--pa-color-accent-border-14)]">
                  <div
                    role="img"
                    aria-label={t.clue.photo}
                    className="min-h-[18rem] bg-cover bg-center sm:min-h-[24rem]"
                    style={{ backgroundImage: `url(${JSON.stringify(clue.imageUrl)})` }}
                  />
                </li>
              );
            }
            return (
              <li key={index} className="flex min-h-12 items-center rounded-xl border border-[var(--pa-color-accent-border-14)] px-4 py-3 font-semibold">
                {clueText(clue, t)}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-6">
        {finished ? (
          <div className="rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-8" role="status">
            <p className="text-2xl font-semibold">{result?.solved ? t.solved(guesses.length) : t.failed}</p>
            {answer ? <p className="mt-3 text-[var(--muted)]">{t.answerIs(answer.name)}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              {result?.answer ? (
                <Link
                  href={`/${locale}/pandas/${result.answer.canonicalSlug}` as Route}
                  className="inline-flex min-h-12 items-center rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
                >
                  {t.open}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void shareResult()}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--pa-color-accent-border-14)] px-5 py-3 font-semibold"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />{copied ? t.copied : t.share}
              </button>
            </div>
            <p className="mt-5 text-sm text-[var(--muted)]">{t.comeBack}</p>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-8">
            <Command
              className="rounded-xl border border-[var(--pa-color-accent-border-14)] bg-[var(--card)] focus-within:ring-2 focus-within:ring-[var(--accent)]"
              label={t.searchLabel}
            >
              <CommandInput
                value={search}
                onValueChange={setSearch}
                placeholder={t.search}
                disabled={guess.isPending}
                className="focus-visible:shadow-none!"
              />
              {search.trim() !== "" ? (
                <CommandList>
                  <CommandEmpty>{t.noMatch}</CommandEmpty>
                  {pandas.filter((panda) => !guessedIds.has(panda.id)).map((panda) => (
                    <CommandItem
                      key={panda.id}
                      value={panda.id}
                      keywords={[panda.name, panda.alternateName ?? "", panda.slug]}
                      onSelect={() => choose(panda.id)}
                    >
                      <span className="font-semibold">{panda.name}</span>
                      {panda.alternateName ? <span className="text-[var(--muted)]">{panda.alternateName}</span> : null}
                    </CommandItem>
                  ))}
                </CommandList>
              ) : null}
            </Command>
            {guess.isError ? <p className="mt-3 text-sm" role="alert">{t.guessError}</p> : null}
          </div>
        )}

        {guesses.length > 0 ? (
          <div className="rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-8">
            <h3 className="font-semibold">{t.yourGuesses}</h3>
            <ol className="mt-4 grid gap-3">
              {guesses.map((item) => (
                <li key={item.pandaId} className="flex items-start gap-3 rounded-xl border border-[var(--pa-color-accent-border-14)] px-4 py-3">
                  {item.correct
                    ? <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                    : <X className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />}
                  <div>
                    <p className="font-semibold">{pandasById.get(item.pandaId)?.name ?? item.pandaId}</p>
                    {!item.correct ? <p className="text-sm text-[var(--muted)]">{feedbackText(item, t).join(" · ")}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
