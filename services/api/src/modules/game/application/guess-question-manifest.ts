// One reviewed intent to add 猜熊猫 questions, read from data/curation/guess-questions/<batch>.json.
// contracts/guess-question-manifest.v1.json documents the same shape; a unit test keeps the two in step.

export interface GuessQuestionManifest {
  batch: string;
  reason: string;
}

export const GUESS_QUESTION_BATCH_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
export const GUESS_QUESTION_REASON_LENGTH = { minimum: 10, maximum: 500 } as const;
const FIELDS = ["schema_version", "batch", "reason"];

export class GuessQuestionManifestError extends Error {
  public constructor(public readonly violations: string[]) {
    super(`猜熊猫 question manifest is invalid: ${violations.join("; ")}`);
    this.name = "GuessQuestionManifestError";
  }
}

/** Validates a parsed manifest; `fileName` is the manifest's base name, which must be `<batch>.json`. */
export function parseGuessQuestionManifest(value: unknown, fileName: string): GuessQuestionManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GuessQuestionManifestError(["the manifest must be a JSON object"]);
  }
  const record = value as Record<string, unknown>;
  const violations: string[] = [];
  for (const key of Object.keys(record)) {
    if (!FIELDS.includes(key)) violations.push(`unknown field ${key}`);
  }
  if (record.schema_version !== 1) violations.push("schema_version must be 1");
  const batch = typeof record.batch === "string" ? record.batch : "";
  if (!GUESS_QUESTION_BATCH_PATTERN.test(batch)) violations.push("batch must look like 2026.10.27.1");
  else if (fileName !== `${batch}.json`) violations.push(`the file must be named ${batch}.json`);
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  if (reason.length < GUESS_QUESTION_REASON_LENGTH.minimum || reason.length > GUESS_QUESTION_REASON_LENGTH.maximum) {
    violations.push(
      `reason must be ${GUESS_QUESTION_REASON_LENGTH.minimum} to ${GUESS_QUESTION_REASON_LENGTH.maximum} characters`,
    );
  }
  if (violations.length > 0) throw new GuessQuestionManifestError(violations);
  return { batch, reason };
}
