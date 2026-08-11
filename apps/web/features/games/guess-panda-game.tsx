"use client";

import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Check, RefreshCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { PublicLocale } from "@/foundation/content/locales";
import { isEngagementUiEnabled } from "@/lib/engagement/config";

type SaveState = "idle" | "saving" | "saved" | "error";

type PendingAttempt = {
  target_panda_id: string;
  selected_panda_id: string;
  public_release_version: string;
};

interface GuessQuestion {
  question_id: string;
  image_url: string;
  image_alt: string;
  difficulty: "easy" | "medium" | "hard";
  options: Array<{ panda_id: string; name: string }>;
}

interface GuessAnswer {
  correct: boolean;
  answer: { panda_id: string; name: string; slug: string };
  recognition_tips: string[];
}

const pendingAttemptKey = "zhipanda:pending-guess-attempt:v1";

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
    saved: "本次结果已保存到你的账号。",
    saveError: "暂时无法保存本次结果。",
    history: "查看游戏历史",
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
    saved: "This result was saved to your account.",
    saveError: "This result could not be saved right now.",
    history: "View game history",
    tips: "Recognition tips",
    loading: "Choosing a question…",
  },
} as const;

export function GuessPandaGame({
  locale,
  publicReleaseVersion,
}: {
  locale: PublicLocale;
  publicReleaseVersion: string;
}) {
  const [question, setQuestion] = useState<GuessQuestion | null>(null);
  const [answerResult, setAnswerResult] = useState<GuessAnswer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gameError, setGameError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const engagementEnabled = isEngagementUiEnabled();
  const t = copy[locale];

  useEffect(() => {
    if (!engagementEnabled) return;
    const raw = window.sessionStorage.getItem(pendingAttemptKey);
    if (!raw) return;
    let payload: PendingAttempt;
    try {
      payload = JSON.parse(raw) as PendingAttempt;
    } catch {
      window.sessionStorage.removeItem(pendingAttemptKey);
      return;
    }
    void fetch("/api/engagement/game-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((response) => {
      if (response.ok) {
        window.sessionStorage.removeItem(pendingAttemptKey);
        setSaveState("saved");
      } else if (response.status !== 401) {
        window.sessionStorage.removeItem(pendingAttemptKey);
        setSaveState("error");
      }
    });
  }, [engagementEnabled]);

  async function startNextRound() {
    setLoading(true);
    setGameError(false);
    setSelectedId(null);
    setAnswerResult(null);
    setSaveState("idle");
    try {
      const response = await fetch("/api/games/guess/question", { cache: "no-store" });
      if (!response.ok) {
        setQuestion(null);
        setGameError(true);
        return;
      }
      setQuestion((await response.json()) as GuessQuestion);
    } catch {
      setQuestion(null);
      setGameError(true);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(pandaId: string) {
    if (!question || answerResult || loading) return;
    setSelectedId(pandaId);
    setLoading(true);
    setGameError(false);
    try {
      const response = await fetch("/api/games/guess/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: question.question_id,
          selected_panda_id: pandaId,
        }),
      });
      if (!response.ok) {
        setSelectedId(null);
        setGameError(true);
        return;
      }
      const result = (await response.json()) as GuessAnswer;
      setAnswerResult(result);
      setAnswered((value) => value + 1);
      if (result.correct) setScore((value) => value + 1);
    } catch {
      setSelectedId(null);
      setGameError(true);
    } finally {
      setLoading(false);
    }
  }

  async function saveAttempt() {
    if (
      !answerResult
      || !selectedId
      || !engagementEnabled
      || saveState === "saving"
      || saveState === "saved"
    ) return;
    const payload: PendingAttempt = {
      target_panda_id: answerResult.answer.panda_id,
      selected_panda_id: selectedId,
      public_release_version: publicReleaseVersion,
    };
    setSaveState("saving");
    const response = await fetch("/api/engagement/game-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      setSaveState("saved");
      return;
    }
    if (response.status === 401) {
      window.sessionStorage.setItem(pendingAttemptKey, JSON.stringify(payload));
      window.location.assign(`/auth/login?next=${encodeURIComponent(`/${locale}/games/guess`)}`);
      return;
    }
    setSaveState("error");
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
          onClick={() => void startNextRound()}
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
          aria-label={question.image_alt || t.mysteryAlt}
          className="min-h-[24rem] bg-cover bg-center sm:min-h-[34rem]"
          style={{ backgroundImage: `url(${JSON.stringify(question.image_url)})` }}
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
            const isAnswer = answerResult?.answer.panda_id === choice.panda_id;
            const isSelected = choice.panda_id === selectedId;
            const icon = answerResult && isAnswer
              ? <Check className="h-4 w-4" aria-hidden="true" />
              : answerResult && isSelected
                ? <X className="h-4 w-4" aria-hidden="true" />
                : null;
            return (
              <button
                key={choice.panda_id}
                type="button"
                disabled={Boolean(answerResult) || loading}
                onClick={() => void submitAnswer(choice.panda_id)}
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
            {answerResult.recognition_tips.length ? (
              <div className="mt-4">
                <strong className="text-sm">{t.tips}</strong>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                  {answerResult.recognition_tips.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => void startNextRound()}
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
                  onClick={() => void saveAttempt()}
                  className="inline-flex min-h-12 items-center rounded-xl border border-[var(--pa-color-accent-border-14)] px-5 py-3 font-semibold disabled:opacity-60"
                >
                  {saveState === "saving" ? t.saving : saveState === "saved" ? t.saved : t.save}
                </button>
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
