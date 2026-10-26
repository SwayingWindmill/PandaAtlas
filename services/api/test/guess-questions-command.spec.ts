import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderGuessQuestionReport } from "../src/guess-questions-command.js";
import {
  GUESS_QUESTION_BATCH_PATTERN,
  GUESS_QUESTION_REASON_LENGTH,
  GuessQuestionManifestError,
  parseGuessQuestionManifest,
} from "../src/modules/game/application/guess-question-manifest.js";

const manifest = { batch: "2026.10.27.1", reason: "First 猜熊猫 questions from the active release." };

describe("猜熊猫 question manifest", () => {
  it("accepts a manifest named after its batch", () => {
    expect(parseGuessQuestionManifest({ schema_version: 1, ...manifest }, "2026.10.27.1.json")).toEqual(manifest);
  });

  it("rejects a misnamed file, unknown fields and a short reason", () => {
    expect(() => parseGuessQuestionManifest({ schema_version: 1, ...manifest }, "latest.json")).toThrow(
      GuessQuestionManifestError,
    );
    expect(() => parseGuessQuestionManifest({ schema_version: 1, ...manifest, limit: 5 }, "2026.10.27.1.json")).toThrow(
      /unknown field limit/,
    );
    expect(() => parseGuessQuestionManifest({ schema_version: 1, ...manifest, reason: "go" }, "2026.10.27.1.json")).toThrow(
      /reason must be/,
    );
  });

  it("matches the documented contract", () => {
    const contract = JSON.parse(
      readFileSync(new URL("../../../contracts/guess-question-manifest.v1.json", import.meta.url), "utf8"),
    ) as { batch_pattern: string; reason_length: unknown; required_fields: string[] };
    expect(contract.batch_pattern).toBe(GUESS_QUESTION_BATCH_PATTERN.source);
    expect(contract.reason_length).toEqual(GUESS_QUESTION_REASON_LENGTH);
    expect(contract.required_fields).toEqual(["schema_version", "batch", "reason"]);
  });

  it("checks the manifest shipped in the repository", () => {
    const shipped: unknown = JSON.parse(
      readFileSync(new URL("../../../data/curation/guess-questions/2026.10.27.1.json", import.meta.url), "utf8"),
    );
    expect(parseGuessQuestionManifest(shipped, "2026.10.27.1.json").batch).toBe("2026.10.27.1");
  });
});

describe("renderGuessQuestionReport", () => {
  it("states what was drawn, what was new and the mix of difficulty", () => {
    const markdown = renderGuessQuestionReport({
      batch: "2026.10.27.1",
      releaseVersion: "2026.10.26.1",
      proposed: 10,
      published: 7,
      byDifficulty: { easy: 2, medium: 3, hard: 5 },
    });
    expect(markdown).toContain("10 questions, 7 newly published, 3 already present.");
    expect(markdown).toContain("| hard | 5 |");
  });
});
