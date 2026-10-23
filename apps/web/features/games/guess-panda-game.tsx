"use client";

import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Check, RefreshCcw, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { fanMutationOptions } from "@/features/fan/api/queries";
import { beginSignIn, signInRequired } from "@/features/fan/api/session";
import type { GameAttemptInput, GuessAnswer, GuessQuestion } from "@/features/fan/api/types";
import type { PublicLocale } from "@/foundation/content/locales";
import { isEngagementUiEnabled } from "@/lib/engagement/config";

type SaveState = "idle" | "saving" | "saved" | "error";

const pendingAttemptKey = "zhipanda:pending-guess-attempt:v2";

const copy = {
  zh: {
    eyebrow: "猜熊猫",
    title: "只看照片，你认得 TA 吗？",
    body: "每一题都由编辑审核后发布。题目只发送照片和四个选项，答案在你提交后才由服务端揭晓。",
    start: "开始猜",
    next: "下一题",
    score: "答对",
    rounds: "已答",
    correct: (name: string) => `答对了，这是${name}。`,
    wrong: (name: string) => `这次没猜中，这是${name}。`,
    open: "打开熊猫资料",
    unavailable: "当前没有可玩的已发布题目，请稍后再来。",
    mysteryAlt: "待猜熊猫的公开照片",
    scoreLabel: "本次游戏成绩",
    save: "保存本次结果",
    saving: "正在保存…",
    saved: "已保存，TA 也点亮在你的熊猫图鉴里。",
    saveError: "暂时无法保存本次结果。",
    history: "查看游戏历史",
    pandaBook: "打开熊猫图鉴",
    tips: "识别提示",
    loading: "正在抽取题目…",
  },
  en: {
    eyebrow: "Guess Panda",
    title: "Can you recognize this panda from a photo?",
    body: "Every question is curated and published by an editor. The client receives only the photo and four choices; the server reveals the answer after submission.",
    start: "Start guessing",
    next: "Next panda",
    score: "Correct",
    rounds: "Answered",
    correct: (name: string) => `Correct — this is ${name}.`,
    wrong: (name: string) => `Not this time — this is ${name}.`,
    open: "Open panda profile",
    unavailable: "There are no published questions available right now.",
    mysteryAlt: "Published panda photo to identify",
    scoreLabel: "Current game score",
    save: "Save this result",
    saving: "Saving…",
    saved: "Saved. This panda is now in your panda book.",
    saveError: "This result could not be saved right now.",
    history: "View game history",
    pandaBook: "Open panda book",
    tips: "Recognition tips",
    loading: "Choosing a question…",
  },
} as const;

export function GuessPandaGame({ locale }: { locale: PublicLocale }) {
  const [question, setQuestion] = useState<GuessQuestion | null>(null);
  const [answerResult, setAnswerResult] = useState<GuessAnswer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [gameError, setGameError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const engagementEnabled = isEngagementUiEnabled();
  const t = copy[locale];

  const nextQuestion = useMutation({
    ...fanMutationOptions.getGuessQuestion(),
    onMutate: () => {
      setGameError(false);
      setSelectedId(null);
      setAnswerResult(null);
      setSaveState("idle");
    },
    onSuccess: (received) => setQuestion(received),
    onError: () => {
      setQuestion(null);
      setGameError(true);
    },
  });
  const answer = useMutation({
    ...fanMutationOptions.answerGuess(),
    onMutate: ({ selectedPandaId }) => {
      setSelectedId(selectedPandaId);
      setGameError(false);
    },
    onSuccess: (result) => {
      setAnswerResult(result);
      setAnswered((value) => value + 1);
      if (result.correct) setScore((value) => value + 1);
    },
    onError: () => {
      setSelectedId(null);
      setGameError(true);
    },
  });
  // Saving needs the session. The attempt is kept until the server has it: a visitor who chose to
  // save is sent to sign in and finds it saved on return; a visitor still signed out keeps it.
  const { mutate: saveMutation } = useMutation(fanMutationOptions.saveGameAttempt());
  const persistAttempt = useCallback((attempt: GameAttemptInput, signInWhenRefused: boolean) => {
    saveMutation(attempt, {
      onSuccess: () => {
        window.sessionStorage.removeItem(pendingAttemptKey);
        setSaveState("saved");
      },
      onError: (error) => {
        if (signInRequired(error)) {
          if (signInWhenRefused) beginSignIn(`/${locale}/games/guess`);
          return;
        }
        window.sessionStorage.removeItem(pendingAttemptKey);
        setSaveState("error");
      },
    });
  }, [locale, saveMutation]);

  useEffect(() => {
    if (!engagementEnabled) return;
    const raw = window.sessionStorage.getItem(pendingAttemptKey);
    if (!raw) return;
    let payload: GameAttemptInput;
    try {
      payload = JSON.parse(raw) as GameAttemptInput;
    } catch {
      window.sessionStorage.removeItem(pendingAttemptKey);
      return;
    }
    persistAttempt(payload, false);
  }, [engagementEnabled, persistAttempt]);

  const loading = nextQuestion.isPending || answer.isPending;

  function submitAnswer(pandaId: string) {
    if (!question || answerResult || loading) return;
    answer.mutate({ questionId: question.questionId, selectedPandaId: pandaId, locale });
  }

  function saveAttempt() {
    if (
      !question
      || !answerResult
      || !selectedId
      || !engagementEnabled
      || saveState === "saving"
      || saveState === "saved"
    ) return;
    const attempt = { questionId: question.questionId, selectedPandaId: selectedId };
    window.sessionStorage.setItem(pendingAttemptKey, JSON.stringify(attempt));
    setSaveState("saving");
    persistAttempt(attempt, true);
  }

  if (!question) {
    return (
      <section className="rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-10">
        <p className="text-sm font-semibold text-[var(--accent)]">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          {t.title}
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">{t.body}</p>
        {gameError ? <p className="mt-4 text-sm" role="alert">{t.unavailable}</p> : null}
        {saveState === "saved" ? <p className="mt-4 text-sm font-semibold text-[var(--accent)]" role="status">{t.saved}</p> : null}
        <button
          type="button"
          disabled={loading}
          onClick={() => nextQuestion.mutate(locale)}
          className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? t.loading : t.start}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:items-start">
      <div className="overflow-hidden rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)]">
        <div
          role="img"
          aria-label={question.imageAlt || t.mysteryAlt}
          className="min-h-[24rem] bg-cover bg-center sm:min-h-[34rem]"
          style={{ backgroundImage: `url(${JSON.stringify(question.imageUrl)})` }}
        />
      </div>

      <div className="rounded-[2rem] border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-6 sm:p-8">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)]" aria-label={t.scoreLabel}>
          <span>{t.score}: <strong className="text-[var(--fg)]">{score}</strong></span>
          <span>{t.rounds}: <strong className="text-[var(--fg)]">{answered}</strong></span>
          <span>{question.difficulty}</span>
        </div>
        <h2 className="mt-5 text-2xl font-semibold">{t.title}</h2>
        <div className="mt-6 grid gap-3">
          {question.options.map((choice) => {
            const isAnswer = answerResult?.answer.pandaId === choice.pandaId;
            const isSelected = choice.pandaId === selectedId;
            const icon = answerResult && isAnswer
              ? <Check className="h-4 w-4" aria-hidden="true" />
              : answerResult && isSelected
                ? <X className="h-4 w-4" aria-hidden="true" />
                : null;
            return (
              <button
                key={choice.pandaId}
                type="button"
                disabled={Boolean(answerResult) || loading}
                onClick={() => submitAnswer(choice.pandaId)}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-[var(--pa-color-accent-border-14)] px-4 py-3 text-left font-semibold disabled:cursor-default disabled:opacity-100"
              >
                <span>{choice.name}</span>{icon}
              </button>
            );
          })}
        </div>

        {gameError ? <p className="mt-4 text-sm" role="alert">{t.unavailable}</p> : null}
        {answerResult ? (
          <div className="mt-6 rounded-2xl bg-[var(--surface-muted)] p-5" role="status">
            <p className="font-semibold">
              {answerResult.correct ? t.correct(answerResult.answer.name) : t.wrong(answerResult.answer.name)}
            </p>
            {answerResult.recognitionTips.length ? (
              <div className="mt-4">
                <strong className="text-sm">{t.tips}</strong>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                  {answerResult.recognitionTips.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => nextQuestion.mutate(locale)}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />{t.next}
              </button>
              <Link
                href={`/${locale}/pandas/${answerResult.answer.slug}` as Route}
                className="inline-flex min-h-12 items-center rounded-xl border border-[var(--pa-color-accent-border-14)] px-5 py-3 font-semibold"
              >
                {t.open}
              </Link>
              {engagementEnabled ? (
                <button
                  type="button"
                  disabled={saveState === "saving" || saveState === "saved"}
                  onClick={saveAttempt}
                  className="inline-flex min-h-12 items-center rounded-xl border border-[var(--pa-color-accent-border-14)] px-5 py-3 font-semibold disabled:opacity-60"
                >
                  {saveState === "saving" ? t.saving : saveState === "saved" ? t.saved : t.save}
                </button>
              ) : null}
              {saveState === "saved" ? (
                <Link
                  href={`/${locale}/me/panda-book` as Route}
                  className="inline-flex min-h-12 items-center rounded-xl px-2 py-3 font-semibold text-[var(--accent)] underline underline-offset-4"
                >
                  {t.pandaBook}
                </Link>
              ) : null}
              {engagementEnabled ? (
                <Link
                  href={`/${locale}/me/game-history` as Route}
                  className="inline-flex min-h-12 items-center rounded-xl px-2 py-3 font-semibold text-[var(--accent)] underline underline-offset-4"
                >
                  {t.history}
                </Link>
              ) : null}
            </div>
            {saveState === "error" ? <p className="mt-3 text-sm" role="alert">{t.saveError}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
