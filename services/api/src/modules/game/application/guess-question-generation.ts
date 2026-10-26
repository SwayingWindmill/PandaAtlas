import type { GameDifficulty } from "./game.application.js";

// 猜熊猫 questions drawn from the active public release: each living panda with a public cover photo becomes one
// question whose other three options are pandas a visitor could mistake it for, preferring pandas that live at
// the same place. Choices are stable (a hash of the ids, not Math.random), so a repeated run proposes the same
// questions and the (target, photo) key keeps it from writing twice.

export interface GuessCandidate {
  pandaId: string;
  /** The Chinese name fans know it by; pandas without one are not asked about or offered. */
  name: string | null;
  living: boolean;
  /** Year of a confirmed birth date. */
  birthYear: number | null;
  placeId: string | null;
  placeName: string | null;
  /** The public cover photo in the active release. */
  coverAssetId: string | null;
}

export interface GeneratedQuestion {
  targetPandaId: string;
  mediaAssetId: string;
  difficulty: GameDifficulty;
  /** Four ids, the target among them. */
  optionPandaIds: string[];
  /** Shown after the answer. */
  tips: string[];
}

/** FNV-1a: a stable, well-spread order without randomness. */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

function byHash(seed: string) {
  return (a: GuessCandidate, b: GuessCandidate) => hash(`${seed}:${a.pandaId}`) - hash(`${seed}:${b.pandaId}`);
}

function tipsFor(target: GuessCandidate): string[] {
  return [
    target.birthYear === null ? null : `${target.name}${target.birthYear} 年出生。`,
    target.placeName === null ? null : `现在住在${target.placeName}。`,
  ].filter((tip): tip is string => tip !== null);
}

export function generateGuessQuestions(candidates: GuessCandidate[]): GeneratedQuestion[] {
  const named = candidates.filter((candidate) => candidate.living && candidate.name !== null);
  if (named.length < 4) return [];
  const questions: GeneratedQuestion[] = [];
  for (const target of named) {
    if (target.coverAssetId === null) continue;
    const others = named.filter((candidate) => candidate.pandaId !== target.pandaId);
    const neighbours = others
      .filter((candidate) => target.placeId !== null && candidate.placeId === target.placeId)
      .sort(byHash(target.pandaId))
      .slice(0, 3);
    const rest = others
      .filter((candidate) => !neighbours.includes(candidate))
      .sort(byHash(target.pandaId))
      .slice(0, 3 - neighbours.length);
    const distractors = [...neighbours, ...rest].map((candidate) => candidate.pandaId);
    const position = hash(target.pandaId) % 4;
    distractors.splice(position, 0, target.pandaId);
    questions.push({
      targetPandaId: target.pandaId,
      mediaAssetId: target.coverAssetId,
      difficulty: neighbours.length === 3 ? "hard" : neighbours.length > 0 ? "medium" : "easy",
      optionPandaIds: distractors,
      tips: tipsFor(target),
    });
  }
  return questions;
}
