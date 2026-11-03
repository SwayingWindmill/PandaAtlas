import type { components } from "@zhipanda/api-client";

import { authedApi } from "@/lib/api";

// 问问熊猫: a signed-in fan asks a panda question and gets a short answer drawn only from Zhipanda's own
// published 科普 and panda records, with the pages it came from. The API owns every rule (the daily
// allowance, the length, what it refuses); the app keeps nothing: questions and answers live in memory
// for as long as the screen is open.

export type AskAnswer = components["schemas"]["AskAnswerDto"];
export type AskLink = components["schemas"]["AskLinkDto"];
export type AskStatus = components["schemas"]["AskStatusDto"];

/** The API's own limit, counted the way it counts (services/api ask-guard). */
export const QUESTION_LIMIT = 500;

export type AskFailure = "disabled" | "tooLong" | "rateLimited" | "quotaExhausted" | "dailyCap" | "failed";

export class AskError extends Error {
  public constructor(public readonly failure: AskFailure) {
    super(`Ask Panda ${failure}`);
  }
}

/** What the fan reads when a question could not be asked. */
export const FAILURE_COPY: Record<AskFailure, string> = {
  disabled: "问问熊猫暂时关闭了。",
  tooLong: `问题太长了，请控制在 ${QUESTION_LIMIT} 字以内。`,
  rateLimited: "问得有点快，过一分钟再试。",
  quotaExhausted: "今天的提问次数用完了，明天再来。",
  dailyCap: "今天大家问得太多，问问熊猫先休息了，明天再来。",
  failed: "没有连上，请再试一次。",
};

/** Failures that end today's asking: the composer gives way to a sentence. */
export function closesToday(failure: AskFailure): boolean {
  return failure === "quotaExhausted" || failure === "dailyCap" || failure === "disabled";
}

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/gu;

/** The question as the API will read it: NFKC, no invisible characters, one space between words. */
export function cleanQuestion(text: string): string {
  return text.normalize("NFKC").replace(INVISIBLE, "").replace(/\s+/gu, " ").trim();
}

/** Characters the API counts (code points, after cleaning). */
export function questionLength(text: string): number {
  return [...cleanQuestion(text)].length;
}

/** Whether the question can be sent: something to ask and within the limit. */
export function canSend(text: string): boolean {
  const length = questionLength(text);
  return length > 0 && length <= QUESTION_LIMIT;
}

// Only pages the app has: an answer may never send the fan somewhere else inside the app.
const APP_PATHS = [
  /^\/learn$/u,
  /^\/learn\/challenge$/u,
  /^\/learn\/(articles|terms|faces)\/[a-z0-9][a-z0-9-]*$/u,
  /^\/pandas\/[a-z0-9][a-z0-9-]*$/u,
];

/** The in-app page a source opens, or null when the path is not one the app knows. */
export function appHref(path: string): string | null {
  return APP_PATHS.some((pattern) => pattern.test(path)) ? path : null;
}

const KIND_LABEL: Record<string, string> = {
  article: "科普文章",
  card: "科普卡片",
  topic: "认识大熊猫",
  term: "名词",
  faceGuide: "认脸指南",
  challenge: "认脸挑战",
  panda: "熊猫资料",
  learn: "认识大熊猫",
};

/** The second line under a source: who published what it rests on, or what kind of page it is. */
export function sourceDetail(link: AskLink): string {
  const publishers = [...new Set(link.references.map((reference) => reference.publisher ?? reference.title))];
  return publishers.length > 0 ? publishers.join(" · ") : (KIND_LABEL[link.kind] ?? "");
}

/** https references only; anything else is shown as plain text. */
export function referenceUrl(url: string): string | null {
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function failureOf(status: number, error: unknown): AskFailure {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "ask.disabled" || status === 503) return "disabled";
  if (code === "ask.questionTooLong") return "tooLong";
  if (code === "ask.quotaExhausted") return "quotaExhausted";
  if (code === "ask.dailyCapReached") return "dailyCap";
  if (code === "ask.rateLimited" || status === 429) return "rateLimited";
  return "failed";
}

export async function loadAskStatus(): Promise<AskStatus> {
  const { data, error, response } = await authedApi.GET("/api/v2/ask/status");
  if (data) return data;
  throw new AskError(failureOf(response.status, error));
}

export async function askPanda(question: string): Promise<AskAnswer> {
  const { data, error, response } = await authedApi.POST("/api/v2/ask", { body: { question: cleanQuestion(question) } });
  if (data) return data;
  throw new AskError(failureOf(response.status, error));
}

/** Questions to start from, each answered by a published page (test/ask-eval in services/api). */
export const STARTERS = ["大熊猫每天吃多少竹子？", "大熊猫的黑眼圈是熬夜熬出来的吗？", "宝力和青宝有什么区别？"];
