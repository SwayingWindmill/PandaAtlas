import type { AskDocumentKind, AskSourceLink } from "./ask-corpus.js";
import { type AskPassage, buildMessages, checkCitations, isRetryableCitationFailure, parseModelAnswer } from "./ask-answer.js";
import { checkQuestion, isIdentificationQuestion, looksLikePromptInjection, type AskLocale } from "./ask-guard.js";
import {
  ASK_ACCOUNT_DAILY_LIMIT,
  ASK_FALLBACK_MODEL,
  ASK_MAIN_MODEL,
  ASK_MAX_ANSWER_TOKENS,
  ASK_MAX_PASSAGES,
  ASK_MIN_PASSAGE_SCORE,
  beijingDay,
} from "./ask-policy.js";
import type { AskIndexRepository, AskIndexRow, AskQuotaRepository, AskRuntimeBindings } from "./ask.ports.js";

export const ASK_PORT = Symbol("ASK_PORT");

export interface AskLink {
  kind: AskDocumentKind | "learn";
  title: string;
  appPath: string;
  references: AskSourceLink[];
}

export type AskRefusalReason = "noMatch" | "unsafe" | "unavailable";

export type AskOutcome =
  | { kind: "answer"; locale: AskLocale; answer: string; sources: AskLink[]; remainingToday: number }
  | { kind: "refusal"; locale: AskLocale; reason: AskRefusalReason; message: string; links: AskLink[]; remainingToday: number }
  | { kind: "identification"; locale: AskLocale; message: string; links: AskLink[]; remainingToday: number };

export type AskFailureCode =
  | "ask.disabled"
  | "ask.questionEmpty"
  | "ask.questionTooLong"
  | "ask.rateLimited"
  | "ask.quotaExhausted"
  | "ask.dailyCapReached";

export class AskFailure extends Error {
  public constructor(public readonly code: AskFailureCode) {
    super(code);
    this.name = "AskFailure";
  }
}

/** Metadata about one question for logs. Never carries the question or the answer text. */
export interface AskTrace {
  outcome: AskOutcome["kind"] | AskFailureCode;
  reason?: string;
  model?: string;
  passages?: number;
  latencyMs: number;
}

export interface AskSettings {
  enabled: boolean;
  globalDailyCap: number;
  accountDailyLimit?: number;
}

const MESSAGES: Record<AskLocale, Record<AskRefusalReason | "identification", string>> = {
  zh: {
    noMatch: "吱熊猫的资料里还没有能回答这个问题的内容。可以换个问法，或者去「认识大熊猫」看看。",
    unsafe: "这个问题我没法回答。问问熊猫只回答和大熊猫有关、吱熊猫资料里写到的问题。",
    unavailable: "现在暂时回答不了，请稍后再试。",
    identification: "问问熊猫不会凭长相或照片判断是哪只熊猫。认脸指南教你自己看出区别：",
  },
  en: {
    noMatch: "Zhipanda's material doesn't cover this yet. Try asking another way, or browse Learn.",
    unsafe: "I can't answer that. Ask Panda only answers panda questions covered by Zhipanda's material.",
    unavailable: "Ask Panda can't answer right now. Please try again later.",
    identification: "Ask Panda doesn't name a panda from its looks or a photo. The face guides show you how to tell them apart:",
  },
};

const LEARN_LINK: AskLink = { kind: "learn", title: "认识大熊猫", appPath: "/learn", references: [] };

function linkOf(row: AskIndexRow, locale: AskLocale): AskLink {
  return {
    kind: row.kind,
    title: locale === "en" && row.titleEn !== null ? row.titleEn : row.titleZh,
    appPath: row.appPath,
    references: row.sources,
  };
}

// Several passages can come from one page (an article's sections); show the page once.
function mergeByPage(links: AskLink[]): AskLink[] {
  const pages = new Map<string, AskLink>();
  for (const link of links) {
    const page = pages.get(link.appPath);
    if (page === undefined) {
      pages.set(link.appPath, { ...link, references: [...link.references] });
      continue;
    }
    for (const reference of link.references) {
      if (!page.references.some((known) => known.url === reference.url)) page.references.push(reference);
    }
  }
  return [...pages.values()];
}

export class AskApplication {
  public constructor(
    private readonly settings: AskSettings,
    private readonly quota: AskQuotaRepository,
    private readonly index: AskIndexRepository,
    private readonly runtime: () => AskRuntimeBindings | undefined,
    private readonly clock: () => Date = () => new Date(),
    private readonly trace: (trace: AskTrace) => void = () => undefined,
  ) {}

  private get accountLimit(): number {
    return this.settings.accountDailyLimit ?? ASK_ACCOUNT_DAILY_LIMIT;
  }

  public async status(accountId: string): Promise<{ enabled: boolean; dailyLimit: number; remainingToday: number }> {
    if (!this.settings.enabled) return { enabled: false, dailyLimit: this.accountLimit, remainingToday: 0 };
    const used = await this.quota.used(accountId, beijingDay(this.clock()));
    return { enabled: true, dailyLimit: this.accountLimit, remainingToday: Math.max(0, this.accountLimit - used) };
  }

  public async ask(accountId: string, rawQuestion: string, clientKey: string): Promise<AskOutcome> {
    const started = this.clock().getTime();
    const finish = (outcome: AskOutcome, extra: Partial<AskTrace> = {}): AskOutcome => {
      this.trace({
        outcome: outcome.kind,
        ...(outcome.kind === "refusal" ? { reason: outcome.reason } : {}),
        ...extra,
        latencyMs: this.clock().getTime() - started,
      });
      return outcome;
    };
    const fail = (code: AskFailureCode): never => {
      this.trace({ outcome: code, latencyMs: this.clock().getTime() - started });
      throw new AskFailure(code);
    };

    const runtime = this.runtime();
    if (!this.settings.enabled || runtime === undefined) return fail("ask.disabled");
    const check = checkQuestion(rawQuestion);
    if (!check.ok) return fail(check.reason === "empty" ? "ask.questionEmpty" : "ask.questionTooLong");
    const { question, locale } = check;
    if (!(await runtime.rateLimiter.allow(clientKey))) return fail("ask.rateLimited");

    const day = beijingDay(this.clock());
    if (looksLikePromptInjection(question)) {
      const remainingToday = Math.max(0, this.accountLimit - (await this.quota.used(accountId, day)));
      return finish({ kind: "refusal", locale, reason: "unsafe", message: MESSAGES[locale].unsafe, links: [], remainingToday });
    }
    if (isIdentificationQuestion(question)) {
      const remainingToday = Math.max(0, this.accountLimit - (await this.quota.used(accountId, day)));
      const guides = await this.index.byKinds(["faceGuide"]);
      const links = guides.map((row) => linkOf(row, locale));
      return finish({
        kind: "identification",
        locale,
        message: MESSAGES[locale].identification,
        links: [...links, { ...LEARN_LINK, title: locale === "en" ? "Learn" : LEARN_LINK.title }],
        remainingToday,
      });
    }

    const reservation = await this.quota.reserve(accountId, day, this.accountLimit, this.settings.globalDailyCap);
    if (!reservation.ok) return fail(reservation.scope === "account" ? "ask.quotaExhausted" : "ask.dailyCapReached");
    const { remainingToday } = reservation;
    const refuse = (reason: AskRefusalReason, extra: Partial<AskTrace> = {}) =>
      finish({ kind: "refusal", locale, reason, message: MESSAGES[locale][reason], links: [], remainingToday }, extra);

    let chunks;
    try {
      chunks = await runtime.index.search(question, ASK_MAX_PASSAGES);
    } catch {
      return refuse("unavailable", { reason: "searchFailed" });
    }
    const relevant = chunks.filter((chunk) => chunk.score >= ASK_MIN_PASSAGE_SCORE);
    const rows = new Map((await this.index.uploadedByKeys([...new Set(relevant.map((chunk) => chunk.itemKey))])).map((row) => [row.itemKey, row]));
    const passages: AskPassage[] = relevant
      .filter((chunk) => rows.has(chunk.itemKey))
      .slice(0, ASK_MAX_PASSAGES)
      .map((chunk, index) => ({ label: `S${index + 1}`, itemKey: chunk.itemKey, text: chunk.text }));
    if (passages.length === 0) return refuse("noMatch", { passages: 0 });

    const messages = buildMessages(question, passages, locale);
    let rejected: { reason: string; model: string } | null = null;
    for (const model of [ASK_MAIN_MODEL, ASK_FALLBACK_MODEL]) {
      let raw: string;
      try {
        raw = await runtime.model.complete(model, messages, ASK_MAX_ANSWER_TOKENS);
      } catch {
        continue;
      }
      const parsed = parseModelAnswer(raw);
      if (parsed === null) continue;
      const checked = checkCitations(parsed, passages);
      if (!checked.ok) {
        rejected = { reason: checked.reason, model };
        // A citation that does not match its passage gets one more try with the other model; a
        // refusal or unsafe text is final.
        if (isRetryableCitationFailure(checked.reason)) continue;
        break;
      }
      const sources = mergeByPage(
        checked.itemKeys.flatMap((key) => {
          const row = rows.get(key);
          return row === undefined ? [] : [linkOf(row, locale)];
        }),
      );
      return finish({ kind: "answer", locale, answer: checked.answer, sources, remainingToday }, { model, passages: passages.length });
    }
    if (rejected !== null) {
      return finish(
        { kind: "refusal", locale, reason: "noMatch", message: MESSAGES[locale].noMatch, links: [], remainingToday },
        { reason: rejected.reason, model: rejected.model, passages: passages.length },
      );
    }
    return refuse("unavailable", { reason: "modelFailed", passages: passages.length });
  }
}
