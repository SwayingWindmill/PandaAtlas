import { describe, expect, it } from "vitest";

import {
  DailyPandaApplication,
  dailyPandaClues,
  isDailyPandaCandidate,
  puzzleDateOf,
  type DailyPandaRepository,
} from "../src/modules/game/application/daily-panda.application.js";
import type {
  PublicPandaDetail,
  PublicPandaSummary,
  PublicReadPort,
} from "../src/modules/publication/application/public-read.application.js";

const RELEASE = { releaseId: "release-1", version: "2026.10.22.1" };

function fact(fieldKey: string, value: string, status = "confirmed") {
  return { fieldKey, value, status, lastVerifiedOn: "2026-10-01", conclusionVersion: 1 };
}

function panda(id: string, facts: Record<string, string>, nameZh: string | null = `熊${id}`): PublicPandaSummary {
  return {
    pandaId: id,
    canonicalSlug: `slug-${id}`,
    legacySlugs: [],
    names: nameZh === null ? [] : [{ languageTag: "zh-Hans", nameKind: "official", value: nameZh, isPrimary: true }],
    facts: Object.entries(facts).map(([key, value]) => fact(key, value)),
  };
}

const answer = panda("a", { sex: "female", birth_date: "2016-07-12", life_status: "alive", birthplace: "Chengdu Research Base" }, "花花");
const older = panda("b", { sex: "male", birth_date: "2010-08-01" });
const sameYear = panda("c", { sex: "female", birth_date: "2016-01-30" });
const noBirth = panda("d", { sex: "male" });

function publicRead(items: PublicPandaSummary[]): PublicReadPort {
  const detail = (summary: PublicPandaSummary): PublicPandaDetail => ({
    release: RELEASE,
    panda: summary,
    relatives: [],
    lineage: [],
    residencies: [],
    events: [],
    media: [{
      assetId: `asset-${summary.pandaId}`,
      pandaId: summary.pandaId,
      usageRole: "profile",
      displayOrder: 0,
      objectKey: `pandas/${summary.pandaId}.webp`,
      contentSha256: "0".repeat(64),
      mediaType: "image/webp",
    }],
    evidence: [],
  });
  return {
    listPandas: () => Promise.resolve({ kind: "ok", value: { release: RELEASE, items } }),
    getPanda: (slug: string) => {
      const found = items.find((item) => item.pandaId === slug);
      return Promise.resolve(found === undefined ? { kind: "not_found" } : { kind: "ok", value: detail(found) });
    },
  } as unknown as PublicReadPort;
}

function memoryRepository(initial: Record<string, string> = {}): DailyPandaRepository & { days: Map<string, string> } {
  const days = new Map(Object.entries(initial));
  return {
    days,
    findPandaId: (date) => Promise.resolve(days.get(date)),
    recentPandaIds: (since, until) =>
      Promise.resolve([...days.entries()].filter(([date]) => date >= since && date <= until).map(([, id]) => id)),
    choosePanda: (date, id) => {
      if (!days.has(date)) days.set(date, id);
      return Promise.resolve(days.get(date)!);
    },
  };
}

// 2026-10-22 16:30 UTC is already 2026-10-23 in Shanghai.
const NOW = () => new Date("2026-10-22T16:30:00Z");

describe("Daily Panda clues", () => {
  it("dates the puzzle by the Shanghai calendar day", () => {
    expect(puzzleDateOf(NOW())).toBe("2026-10-23");
    expect(puzzleDateOf(new Date("2026-10-22T15:59:59Z"))).toBe("2026-10-22");
  });

  it("orders clues from vague to revealing and ends with the photo", () => {
    const clues = dailyPandaClues(answer, { assetId: "asset-a", objectKey: "pandas/a.webp" });
    expect(clues.map((clue) => clue.kind)).toEqual(["sex", "birth_year", "life_status", "birthplace", "name_initial", "photo"]);
    expect(clues[1]).toEqual({ kind: "birth_year", value: 2016 });
    expect(clues[4]).toEqual({ kind: "name_initial", value: "花" });
  });

  it("skips disputed and missing facts", () => {
    const disputed: PublicPandaSummary = { ...answer, facts: [fact("sex", "female"), fact("birth_date", "2016-07-12", "disputed")] };
    expect(dailyPandaClues(disputed, undefined).map((clue) => clue.kind)).toEqual(["sex", "name_initial"]);
  });

  it("only picks pandas with a sex, a birth year and a Chinese name", () => {
    expect(isDailyPandaCandidate(answer)).toBe(true);
    expect(isDailyPandaCandidate(noBirth)).toBe(false);
    expect(isDailyPandaCandidate(panda("e", { sex: "male", birth_date: "2001-01-01" }, null))).toBe(false);
  });
});

describe("DailyPandaApplication", () => {
  it("chooses one eligible panda for the day, keeps it, and shows only the first clue", async () => {
    const repository = memoryRepository();
    const application = new DailyPandaApplication(repository, publicRead([noBirth, answer]), NOW, () => 0.99);

    const first = await application.today();
    const second = await application.today();

    expect(repository.days.get("2026-10-23")).toBe("a");
    expect(first).toEqual(second);
    expect(first).toEqual({
      kind: "ok",
      puzzle: { puzzleDate: "2026-10-23", maxGuesses: 6, clueCount: 6, clues: [{ kind: "sex", value: "female" }] },
    });
  });

  it("does not repeat a panda chosen in the last 60 days while another is available", async () => {
    const repository = memoryRepository({ "2026-09-01": "a" });
    const application = new DailyPandaApplication(repository, publicRead([answer, sameYear]), NOW, () => 0);
    await application.today();
    expect(repository.days.get("2026-10-23")).toBe("c");
  });

  it("reveals a clue per wrong guess and compares each guess with the answer", async () => {
    const application = new DailyPandaApplication(
      memoryRepository({ "2026-10-23": "a" }),
      publicRead([answer, older, sameYear, noBirth]),
      NOW,
    );

    const result = await application.guess(["b", "c", "d"]);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.result.solved).toBe(false);
    expect(result.result.finished).toBe(false);
    expect(result.result.answer).toBeUndefined();
    expect(result.result.clues.map((clue) => clue.kind)).toEqual(["sex", "birth_year", "life_status", "birthplace"]);
    expect(result.result.guesses).toEqual([
      { pandaId: "b", correct: false, sameSex: false, birthYear: "answer_later" },
      { pandaId: "c", correct: false, sameSex: true, birthYear: "same" },
      { pandaId: "d", correct: false, sameSex: false, birthYear: "unknown" },
    ]);
  });

  it("gives the answer and every clue once the panda is found", async () => {
    const application = new DailyPandaApplication(memoryRepository({ "2026-10-23": "a" }), publicRead([answer, older]), NOW);
    const result = await application.guess(["b", "a"]);
    expect(result.kind === "ok" && result.result).toMatchObject({
      solved: true,
      finished: true,
      answer: { pandaId: "a", canonicalSlug: "slug-a" },
    });
    expect(result.kind === "ok" && result.result.clues).toHaveLength(6);
  });

  it("finishes without solving after six wrong guesses", async () => {
    const others = ["b", "c", "d", "e", "f", "g"].map((id) => panda(id, { sex: "male", birth_date: "2012-05-05" }));
    const application = new DailyPandaApplication(memoryRepository({ "2026-10-23": "a" }), publicRead([answer, ...others]), NOW);
    const result = await application.guess(others.map((item) => item.pandaId));
    expect(result.kind === "ok" && result.result).toMatchObject({ solved: false, finished: true, answer: { pandaId: "a" } });
  });

  it("rejects unpublished guesses and more than six guesses", async () => {
    const application = new DailyPandaApplication(memoryRepository({ "2026-10-23": "a" }), publicRead([answer]), NOW);
    expect(await application.guess(["missing"])).toEqual({ kind: "unknown_panda" });
    expect(await application.guess(["1", "2", "3", "4", "5", "6", "7"])).toEqual({ kind: "too_many_guesses" });
  });

  it("is unavailable when no panda qualifies", async () => {
    const application = new DailyPandaApplication(memoryRepository(), publicRead([noBirth]), NOW);
    expect(await application.today()).toEqual({ kind: "unavailable" });
  });
});
