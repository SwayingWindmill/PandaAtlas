// The limits 问问熊猫 runs under. Changing one is a product decision; keep the privacy page in step.

/** Longest question accepted, in characters after trimming. */
export const ASK_MAX_QUESTION_CHARS = 500;
/** Most tokens the model may write for one answer. */
export const ASK_MAX_ANSWER_TOKENS = 400;
/** Questions one signed-in account may ask in one Beijing day. */
export const ASK_ACCOUNT_DAILY_LIMIT = 20;
/** App-wide questions per Beijing day when ASK_GLOBAL_DAILY_CAP is unset. */
export const ASK_DEFAULT_GLOBAL_DAILY_CAP = 30;
/** Passages retrieved per question. */
export const ASK_MAX_PASSAGES = 6;
/**
 * The lowest retrieval score a passage needs to be shown to the model. Below it the passage is
 * dropped; with nothing left the question is refused without calling the model.
 */
export const ASK_MIN_PASSAGE_SCORE = 0.45;
/** Shortest quote a citation may carry, in characters after normalising. */
export const ASK_MIN_QUOTE_CHARS = 6;

export const ASK_MAIN_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
export const ASK_FALLBACK_MODEL = "@cf/zai-org/glm-4.7-flash";
export const ASK_GATEWAY_ID = "zhipanda-ask";

/** The Beijing calendar day an instant falls on, as YYYY-MM-DD. */
export function beijingDay(now: Date): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
