// Ask Panda evaluation set. The offline part runs in CI: every expected source must be a real
// passage key, every expected mention must appear in that passage, and the question guards must
// sort the set the way it says. The live part is opt-in:
//   ASK_EVAL_PROMPTS=/tmp/prompts.jsonl npx vitest run test/ask-eval  -> writes the model prompts
//   ASK_EVAL_OUTPUTS=/tmp/outputs.jsonl npx vitest run test/ask-eval  -> scores raw model outputs
// Retrieval in the live part is simulated (expected passages plus lexical distractors), so it
// measures the model and the server-side citation check, not AI Search ranking.
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AskPassage, buildMessages, checkCitations, isRetryableCitationFailure, parseModelAnswer } from "../../src/modules/ask/application/ask-answer.js";
import { type AskDocument, type AskPandaFacts, learningDocuments, pandaDocument } from "../../src/modules/ask/application/ask-corpus.js";
import { checkQuestion, isIdentificationQuestion, looksLikePromptInjection } from "../../src/modules/ask/application/ask-guard.js";
import { ASK_MAX_PASSAGES } from "../../src/modules/ask/application/ask-policy.js";
import type { PublicLearningCatalog } from "../../src/modules/learning/application/learning-catalog.js";

interface EvalItem {
  id: string;
  locale: "zh" | "en";
  question: string;
  expect: "answer" | "refuse" | "identify" | "unsafe";
  sources?: string[];
  mentions?: string[];
}

const here = new URL(".", import.meta.url);
const readJsonl = (name: string): EvalItem[] =>
  readFileSync(new URL(name, here), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as EvalItem);

const inCorpus = readJsonl("in-corpus.jsonl");
const outOfCorpus = readJsonl("out-of-corpus.jsonl");
const catalog = JSON.parse(readFileSync(new URL("learning-catalog.2026.11.01.2.json", here), "utf8")) as PublicLearningCatalog;
const pandas = (JSON.parse(readFileSync(new URL("pandas.2026-11-01.json", here), "utf8")) as { pandas: AskPandaFacts[] }).pandas;
const documents: AskDocument[] = [
  ...learningDocuments(catalog),
  ...pandas.flatMap((panda) => {
    const document = pandaDocument(panda);
    return document === null ? [] : [document];
  }),
];

const matches = (key: string, prefix: string) => key === `${prefix}.md` || key.startsWith(`${prefix}/`);
const expectedDocuments = (item: EvalItem) =>
  documents.filter((document) => (item.sources ?? []).some((prefix) => matches(document.key, prefix)));

function terms(text: string): Set<string> {
  const lower = text.normalize("NFKC").toLowerCase();
  const found = new Set<string>(lower.match(/[a-z0-9]{3,}/gu) ?? []);
  const cjk = lower.replace(/[^\u3400-\u9fff]/gu, "");
  for (let index = 0; index < cjk.length - 1; index += 1) found.add(cjk.slice(index, index + 2));
  return found;
}

function lexicalTop(question: string, count: number, exclude: Set<string>): AskDocument[] {
  const asked = terms(question);
  return documents
    .filter((document) => !exclude.has(document.key))
    .map((document) => {
      const own = terms(document.text);
      let shared = 0;
      for (const term of asked) if (own.has(term)) shared += 1;
      return { document, shared };
    })
    .sort((left, right) => right.shared - left.shared || left.document.key.localeCompare(right.document.key))
    .slice(0, count)
    .map(({ document }) => document);
}

/** Expected passages (up to three) first, then lexical distractors; rotated so S1 is not always right. */
function passagesFor(item: EvalItem): AskPassage[] {
  const expected = item.expect === "answer" ? expectedDocuments(item).slice(0, 3) : [];
  const chosen = [...expected, ...lexicalTop(item.question, ASK_MAX_PASSAGES - expected.length, new Set(expected.map((document) => document.key)))];
  const shift = [...item.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % chosen.length;
  const rotated = [...chosen.slice(shift), ...chosen.slice(0, shift)];
  return rotated.map((document, index) => ({ label: `S${index + 1}`, itemKey: document.key, text: document.text }));
}

describe("Ask Panda eval set", () => {
  it("has at least 40 in-corpus and 30 out-of-corpus questions in both languages", () => {
    expect(inCorpus.length).toBeGreaterThanOrEqual(40);
    expect(outOfCorpus.length).toBeGreaterThanOrEqual(30);
    for (const set of [inCorpus, outOfCorpus]) {
      expect(set.some((item) => item.locale === "zh")).toBe(true);
      expect(set.some((item) => item.locale === "en")).toBe(true);
    }
    expect(new Set([...inCorpus, ...outOfCorpus].map((item) => item.id)).size).toBe(inCorpus.length + outOfCorpus.length);
  });

  it.each(inCorpus)("$id points at real passages that state its facts", (item) => {
    const expected = expectedDocuments(item);
    expect(expected.length, `no passage for ${item.sources?.join(", ")}`).toBeGreaterThan(0);
    for (const prefix of item.sources ?? []) {
      expect(documents.some((document) => matches(document.key, prefix)), prefix).toBe(true);
    }
    for (const mention of item.mentions ?? []) {
      expect(expected.some((document) => document.text.includes(mention)), mention).toBe(true);
    }
  });

  it.each([...inCorpus, ...outOfCorpus])("$id is sorted by the question guards as $expect", (item) => {
    const check = checkQuestion(item.question);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.locale).toBe(item.locale);
    expect(looksLikePromptInjection(check.question)).toBe(item.expect === "unsafe");
    if (item.expect !== "unsafe") expect(isIdentificationQuestion(check.question)).toBe(item.expect === "identify");
  });

  const promptsPath = process.env.ASK_EVAL_PROMPTS;
  it.runIf(promptsPath !== undefined)("writes model prompts for the live run", () => {
    const lines = [...inCorpus, ...outOfCorpus]
      .filter((item) => item.expect === "answer" || item.expect === "refuse")
      .map((item) => JSON.stringify({ id: item.id, messages: buildMessages(item.question, passagesFor(item), item.locale) }));
    writeFileSync(promptsPath ?? "", `${lines.join("\n")}\n`);
  });

  const outputsPath = process.env.ASK_EVAL_OUTPUTS;
  it.runIf(outputsPath !== undefined)("scores the live outputs", () => {
    // One line per model attempt, in the order the application tries them.
    const attempts = new Map<string, { id: string; model: string; raw: string | null }[]>();
    for (const line of readFileSync(outputsPath ?? "", "utf8").split("\n")) {
      if (line.trim() === "") continue;
      const row = JSON.parse(line) as { id: string; model: string; raw: string | null };
      attempts.set(row.id, [...(attempts.get(row.id) ?? []), row]);
    }
    const results = [...inCorpus, ...outOfCorpus]
      .filter((item) => attempts.has(item.id))
      .map((item) => {
        const passages = passagesFor(item);
        let parsed: ReturnType<typeof parseModelAnswer> = null;
        let checked: ReturnType<typeof checkCitations> | null = null;
        let model: string | undefined;
        let tries = 0;
        for (const attempt of attempts.get(item.id) ?? []) {
          tries += 1;
          const candidate = attempt.raw === null ? null : parseModelAnswer(attempt.raw);
          if (candidate === null) continue;
          parsed = candidate;
          model = attempt.model;
          checked = checkCitations(candidate, passages);
          if (checked.ok || !isRetryableCitationFailure(checked.reason)) break;
        }
        const accepted = checked !== null && checked.ok ? checked : null;
        const shown = accepted !== null;
        const expectedKeys = new Set(expectedDocuments(item).map((document) => document.key));
        return {
          id: item.id,
          expect: item.expect,
          model,
          tries,
          parsed: parsed !== null,
          modelRefused: parsed?.refused === true,
          check: checked === null ? "unparsed" : checked.ok ? "ok" : checked.reason,
          shown,
          citesExpected: accepted !== null && accepted.itemKeys.some((key) => expectedKeys.has(key)),
          mentions: accepted === null ? null : (item.mentions ?? []).every((mention) => accepted.answer.includes(mention)),
          citations: parsed?.citations.length ?? 0,
          answer: accepted?.answer ?? null,
        };
      });
    const answerable = results.filter((row) => row.expect === "answer");
    const unanswerable = results.filter((row) => row.expect === "refuse");
    const modelClaims = results.filter((row) => row.parsed && !row.modelRefused);
    const report = {
      inCorpus: {
        total: answerable.length,
        shown: answerable.filter((row) => row.shown).length,
        citesExpected: answerable.filter((row) => row.citesExpected).length,
        mentionsAll: answerable.filter((row) => row.mentions === true).length,
      },
      outOfCorpus: {
        total: unanswerable.length,
        refused: unanswerable.filter((row) => !row.shown).length,
        refusedByModel: unanswerable.filter((row) => row.modelRefused).length,
      },
      citationValidity: {
        modelAnswersWithCitations: modelClaims.length,
        passedServerCheck: modelClaims.filter((row) => row.check === "ok").length,
      },
      rows: results,
    };
    writeFileSync((outputsPath ?? "").replace(/\.jsonl$/u, ".report.json"), JSON.stringify(report, null, 2));
    expect(results.length).toBeGreaterThan(0);
  });
});
