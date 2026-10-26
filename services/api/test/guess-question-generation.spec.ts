import { describe, expect, it } from "vitest";
import { type GuessCandidate, generateGuessQuestions } from "../src/modules/game/application/guess-question-generation.js";

function candidate(pandaId: string, overrides: Partial<GuessCandidate> = {}): GuessCandidate {
  return {
    pandaId,
    name: `熊猫${pandaId}`,
    living: true,
    birthYear: 2020,
    placeId: "chengdu",
    placeName: "成都大熊猫繁育研究基地",
    coverAssetId: `cover-${pandaId}`,
    ...overrides,
  };
}

describe("generateGuessQuestions", () => {
  it("asks about each living, named panda with a cover, among three others", () => {
    const candidates = [
      candidate("a"),
      candidate("b"),
      candidate("c"),
      candidate("d"),
      candidate("e", { coverAssetId: null }),
      candidate("f", { living: false }),
      candidate("g", { name: null }),
    ];
    const questions = generateGuessQuestions(candidates);
    expect(questions.map((question) => question.targetPandaId).sort()).toEqual(["a", "b", "c", "d"]);
    for (const question of questions) {
      expect(question.optionPandaIds).toHaveLength(4);
      expect(new Set(question.optionPandaIds).size).toBe(4);
      expect(question.optionPandaIds).toContain(question.targetPandaId);
      expect(question.optionPandaIds).not.toContain("f");
      expect(question.optionPandaIds).not.toContain("g");
      expect(question.mediaAssetId).toBe(`cover-${question.targetPandaId}`);
    }
  });

  it("prefers pandas at the same place and rates difficulty by how many it found", () => {
    const candidates = [
      candidate("t", { placeId: "atlanta" }),
      candidate("n1", { placeId: "atlanta" }),
      candidate("x1"),
      candidate("x2"),
      candidate("x3"),
    ];
    const question = generateGuessQuestions(candidates).find((item) => item.targetPandaId === "t");
    expect(question?.difficulty).toBe("medium");
    expect(question?.optionPandaIds).toContain("n1");

    const crowded = generateGuessQuestions([candidate("a"), candidate("b"), candidate("c"), candidate("d")]);
    expect(crowded.every((item) => item.difficulty === "hard")).toBe(true);
    const scattered = generateGuessQuestions(["a", "b", "c", "d"].map((id) => candidate(id, { placeId: id })));
    expect(scattered.every((item) => item.difficulty === "easy")).toBe(true);
  });

  it("is stable across runs and words tips from confirmed facts only", () => {
    const candidates = ["a", "b", "c", "d", "e"].map((id) => candidate(id));
    const byTarget = (questions: ReturnType<typeof generateGuessQuestions>) =>
      [...questions].sort((left, right) => left.targetPandaId.localeCompare(right.targetPandaId));
    expect(byTarget(generateGuessQuestions([...candidates].reverse()))).toEqual(byTarget(generateGuessQuestions(candidates)));
    const [question] = generateGuessQuestions([candidate("a", { birthYear: null, placeName: null }), candidate("b"), candidate("c"), candidate("d")]);
    expect(question?.tips).toEqual([]);
    expect(generateGuessQuestions([candidate("a"), candidate("b"), candidate("c"), candidate("d")])[0]?.tips).toEqual([
      "熊猫a2020 年出生。",
      "现在住在成都大熊猫繁育研究基地。",
    ]);
  });

  it("proposes nothing when fewer than four pandas can be options", () => {
    expect(generateGuessQuestions([candidate("a"), candidate("b"), candidate("c")])).toEqual([]);
  });
});
