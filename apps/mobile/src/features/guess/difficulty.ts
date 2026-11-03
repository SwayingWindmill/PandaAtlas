// 猜熊猫 levels. The API draws harder questions by putting more of the other choices in the answer's current place,
// so each level is explained by that rule, never by how the pandas look.

export type GuessDifficulty = "easy" | "medium" | "hard";

/** What each level means, from how the questions are drawn: the other choices live elsewhere, or with the answer. */
export const DIFFICULTIES: readonly { value: GuessDifficulty; label: string; meaning: string }[] = [
  { value: "easy", label: "简单", meaning: "其他选项都不和它住在一起" },
  { value: "medium", label: "中等", meaning: "有的选项和它住在一起" },
  { value: "hard", label: "困难", meaning: "四个选项住在同一个地方" },
];

export function difficultyOf(value: GuessDifficulty): { value: GuessDifficulty; label: string; meaning: string } {
  return DIFFICULTIES.find((item) => item.value === value) ?? { value, label: value, meaning: "" };
}

/** What a probe of one level found: a question, none published (404), or nothing known (offline, a 500). */
export type LevelProbe = "ready" | "empty" | "unknown";

/**
 * The levels to offer, easiest first. A level the server answered with no question is left out, so nobody picks
 * a level that cannot serve; a level that only failed to load stays in. The current level stays in even when empty,
 * so the control never loses its selection; switching away hides it.
 */
export function offeredLevels(
  probes: Partial<Record<GuessDifficulty, LevelProbe>>,
  current: GuessDifficulty | "any",
): GuessDifficulty[] {
  return DIFFICULTIES.map(({ value }) => value).filter((value) => probes[value] !== "empty" || value === current);
}
