import type { components } from "@zhipanda/api-client";
import { describe, expect, it } from "vitest";

import { chineseName, displayChineseName, displayName } from "./panda";

type PandaSummary = components["schemas"]["PublicPandaSummaryDto"];
type Name = PandaSummary["names"][number];

function panda(slug: string, names: Name[]): PandaSummary {
  return { pandaId: `id-${slug}`, canonicalSlug: slug, legacySlugs: [], names, facts: [] };
}

/** Names exactly as the public API returns them (release 2026.10.02.1-photo-only, read 2026-10-30). */
const REAL = {
  "kouhin-shirahama": panda("kouhin-shirahama", [
    { value: "Kouhin", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "Kouhin / 幸浜", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
    { value: "幸浜", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
  ]),
  "yuihin-shirahama": panda("yuihin-shirahama", [
    { value: "Yuihin", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "Yuihin / 結浜", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
    { value: "Jie Bang", nameKind: "alias", isPrimary: false, languageTag: "en" },
    { value: "結浜", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
    { value: "结浜", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
  ]),
  "hu-chun-indonesia": panda("hu-chun-indonesia", [
    { value: "Hu Chun", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "Hu Chun / 湖春", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
  ]),
  "ninety-nine-xiaoyatou-offspring-2023": panda("ninety-nine-xiaoyatou-offspring-2023", [
    { value: "99", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "九九 / 99", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
    { value: "99 / 九九", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
  ]),
  "tuan-tuan-taipei": panda("tuan-tuan-taipei", [
    { value: "Tuan Tuan", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "Tuan Tuan / 團團", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
    { value: "团团", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
  ]),
  "yuan-bao": panda("yuan-bao", [
    { value: "Yuan Bao", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "Yuan Bao / 圓寶", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
    { value: "圆宝", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
  ]),
  "ya-guang-chengdu-lineage": panda("ya-guang-chengdu-lineage", [
    { value: "Ya Guang", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "娅光 (Ya Ya", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
    { value: "Ya Guang / 娅光", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
    { value: "娅光", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
    { value: "娅光 / Ya Guang", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
    { value: "娅娅 lineage)", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
  ]),
  "ya-lao-da-chengdu-lineage": panda("ya-lao-da-chengdu-lineage", [
    { value: "Ya Lao Da", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "娅老大 (Ya Ya", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
    { value: "Ya Lao Da / 娅老大", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
    { value: "娅娅 lineage)", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
    { value: "娅老大", nameKind: "alias", isPrimary: false, languageTag: "zh-Hans" },
  ]),
  "happy-sichuan-london-stlouis-5": panda("happy-sichuan-london-stlouis-5", [
    { value: "Happy", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "Happy", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
  ]),
  "mei-mei-harkness-brookfield-1937": panda("mei-mei-harkness-brookfield-1937", [
    { value: "Mei-Mei / Diana", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "Mei-Mei / Diana", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
  ]),
  "bo-si-tiantian-offspring": panda("bo-si-tiantian-offspring", [
    { value: "Bo Si", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
  ]),
  "a-jie-ningbo-2015": panda("a-jie-ningbo-2015", [
    { value: "A Jie", nameKind: "official_romanization", isPrimary: true, languageTag: "en" },
    { value: "阿杰", nameKind: "official", isPrimary: true, languageTag: "zh-Hans" },
  ]),
} satisfies Record<string, PandaSummary>;

describe("displayName: display-only name cleanup (docs/data/2026-10-31-name-cleanup-proposal.md)", () => {
  it("A: shows the Han part of 罗马字 / 汉字, in the data's own form (浜 stays 浜)", () => {
    expect(displayName(REAL["kouhin-shirahama"])).toBe("幸浜");
    expect(displayName(REAL["yuihin-shirahama"])).toBe("結浜");
    expect(displayName(REAL["hu-chun-indonesia"])).toBe("湖春");
    expect(displayName(REAL["ninety-nine-xiaoyatou-offspring-2023"])).toBe("九九");
  });

  it("A, Taipei: shows the panda's existing simplified alias in place of the traditional primary", () => {
    expect(displayName(REAL["tuan-tuan-taipei"])).toBe("团团");
    expect(displayName(REAL["yuan-bao"])).toBe("圆宝");
  });

  it("B: a zh-Hans primary with no Han characters is not a Chinese name, so the English name shows", () => {
    expect(displayChineseName(REAL["happy-sichuan-london-stlouis-5"])).toBeNull();
    expect(displayName(REAL["happy-sichuan-london-stlouis-5"])).toBe("Happy");
    expect(displayChineseName(REAL["mei-mei-harkness-brookfield-1937"])).toBeNull();
    expect(displayName(REAL["mei-mei-harkness-brookfield-1937"])).toBe("Mei-Mei / Diana");
  });

  it("C: a name cut at a bracket on import shows its complete form", () => {
    expect(displayName(REAL["ya-guang-chengdu-lineage"])).toBe("娅光");
    expect(displayName(REAL["ya-lao-da-chengdu-lineage"])).toBe("娅老大");
  });

  it("D: no Chinese name stays English; nothing is adopted from elsewhere", () => {
    expect(displayChineseName(REAL["bo-si-tiantian-offspring"])).toBeNull();
    expect(displayName(REAL["bo-si-tiantian-offspring"])).toBe("Bo Si");
  });

  it("leaves a clean Chinese name alone and never changes the raw data", () => {
    expect(displayName(REAL["a-jie-ningbo-2015"])).toBe(chineseName(REAL["a-jie-ningbo-2015"]));
    expect(chineseName(REAL["kouhin-shirahama"])).toBe("Kouhin / 幸浜");
  });

  it("only ever shows a spelling that is already one of the panda's names, or a part of one", () => {
    for (const item of Object.values(REAL)) {
      const shown = displayName(item);
      expect(item.names.some((name) => name.value === shown || name.value.includes(shown))).toBe(true);
    }
  });
});
