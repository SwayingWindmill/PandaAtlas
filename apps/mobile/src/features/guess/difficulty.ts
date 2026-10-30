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
