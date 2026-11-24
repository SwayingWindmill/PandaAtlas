import type { components } from "@zhipanda/api-client";
import { describe, expect, it } from "vitest";

import { computeLifeStage, extractRichFacts } from "./rich-facts";

type PandaSummary = components["schemas"]["PublicPandaSummaryDto"];

function panda(slug: string, name: string, facts: PandaSummary["facts"]): PandaSummary {
  return {
    pandaId: `id-${slug}`,
    canonicalSlug: slug,
    legacySlugs: [],
    names: [{ value: name, nameKind: "official", isPrimary: true, languageTag: "zh-Hans" }],
    facts,
  };
}

describe("extractRichFacts", () => {
  it("extracts whitelisted star facts for Fu Bao without leaking audit fields or middle dots", () => {
    const fuBao = panda("fu-bao", "福宝", [
      { fieldKey: "sex", value: "female", status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
      { fieldKey: "birth_date", value: "2020-07-20", status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
      { fieldKey: "life_status", value: "alive", status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
      {
        fieldKey: "local.birth_datetime",
        value: { date: "2020-07-20", time: "21:49", place: "Everland Panda World" },
        status: "confirmed",
        lastVerifiedOn: "2026-08-12",
        conclusionVersion: 1,
      },
      {
        fieldKey: "local.birth_size",
        value: { length_cm: 16.5, weight_grams: 197 },
        status: "confirmed",
        lastVerifiedOn: "2026-08-12",
        conclusionVersion: 1,
      },
      {
        fieldKey: "local.current_location",
        value: { area: "幼儿园2号馆203圈舍", facility: "CCRCGP Wolong Shenshuping Base" },
        status: "confirmed",
        lastVerifiedOn: "2026-08-12",
        conclusionVersion: 1,
      },
      { fieldKey: "local.first_birthday_weight_kg", value: 40.6, status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
      { fieldKey: "local.first_public_appearance", value: "2020-11-04", status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
      {
        fieldKey: "local.departed_everland_for_china",
        value: { date: "2024-04-03", everland_days: 1354 },
        status: "confirmed",
        lastVerifiedOn: "2026-08-12",
        conclusionVersion: 1,
      },
      { fieldKey: "local.audit_snapshot_round_2", value: "internal-audit-text", status: "confirmed", lastVerifiedOn: "2026-08-12", conclusionVersion: 1 },
    ]);

    const rich = extractRichFacts({
      panda: fuBao,
      birthPlace: null,
      currentPlace: { short: "卧龙", sub: "神树坪基地" },
      currentPlaceFull: "卧龙神树坪基地",
      placesLived: [{ place: "卧龙神树坪基地", years: "2024 至今", current: true }],
      canonicalMotherName: null,
      today: "2026-11-24",
    });

    expect(rich.studbookNumber).toBeNull();
    expect(rich.leadBio).toBe("2020 年生于爱宝乐园的雌性大熊猫，2024 年 4 月回国，现居卧龙神树坪基地。");
    expect(rich.highlights.map((h) => [h.label, h.value])).toEqual([
      ["住在", "幼儿园2号馆"],
      ["出生时", "197 g"],
      ["出生时刻", "21:49"],
      ["周岁体重", "40.6 kg"],
    ]);
    expect(rich.routeSummary).toEqual({
      fromPlace: "爱宝乐园",
      fromYears: "2020–2024　出生",
      toPlace: "卧龙神树坪",
      toYears: "2024 至今　常驻",
      note: "2020.11.04 首次公开亮相　2024.04.03 返回四川",
    });
    expect(rich.lifeStage?.stageLabel).toBe("成年");
    expect(rich.lifeStage?.countdownText).toBe("距 7 岁生日 238 天");
    expect(JSON.stringify(rich)).not.toContain("·");
    expect(JSON.stringify(rich)).not.toContain("internal-audit");
  });

  it("extracts studbook #1186, twin order, birth stats and bio for Bao Mei without duplicating studbook in highlights", () => {
    const baoMei = panda("bao-mei-abao-twin-2019", "宝妹", [
      { fieldKey: "local.sex", value: "female", status: "provisional", lastVerifiedOn: "2026-07-01", conclusionVersion: 1 },
      { fieldKey: "birth_date", value: "2019-07-06", status: "confirmed", lastVerifiedOn: "2026-07-01", conclusionVersion: 1 },
      { fieldKey: "local.studbook_number", value: 1186, status: "provisional", lastVerifiedOn: "2026-07-01", conclusionVersion: 1 },
      { fieldKey: "local.birth_weight_g", value: 209, status: "provisional", lastVerifiedOn: "2026-07-01", conclusionVersion: 1 },
      { fieldKey: "local.birth_time", value: "09:28", status: "provisional", lastVerifiedOn: "2026-07-01", conclusionVersion: 1 },
      {
        fieldKey: "local.mother",
        value: { name: "Po / 阿宝（美国海归）", subject_id: "a-bao-baoxin-mother-2021" },
        status: "provisional",
        lastVerifiedOn: "2026-07-01",
        conclusionVersion: 1,
      },
      {
        fieldKey: "local.twin",
        value: { name: "Bao Ge / 宝哥", subject_id: "bao-ge-abao-twin-2019", birth_order: "younger", litter_type: "mixed_sex" },
        status: "provisional",
        lastVerifiedOn: "2026-07-01",
        conclusionVersion: 1,
      },
    ]);

    const rich = extractRichFacts({
      panda: baoMei,
      birthPlace: null,
      currentPlace: null,
      currentPlaceFull: null,
      placesLived: [],
      canonicalMotherName: null,
      today: "2026-11-24",
    });

    expect(rich.studbookNumber).toBe("#1186");
    expect(rich.leadBio).toBe("2019 年出生的雌性大熊猫，国际谱系 #1186，妈妈是阿宝，与宝哥为龙凤胎。");
    expect(rich.highlights.map((h) => h.label)).toEqual(["同胎排行", "出生体重", "出生时刻"]);
    expect(rich.highlights[0]).toMatchObject({ value: "龙凤胎姐姐", note: "弟弟是宝哥" });
    expect(rich.extraRelatives).toEqual([
      { slug: "a-bao-baoxin-mother-2021", name: "阿宝", relation: "妈妈" },
      { slug: "bao-ge-abao-twin-2019", name: "宝哥", relation: "龙凤胎弟弟" },
    ]);
    expect(rich.recommendedArticleSlug).toBe("cubs");
  });

  it("extracts translated identifying traits and care adjustments for He Hua without raw English", () => {
    const heHua = panda("he-hua-chengdu", "和花", [
      { fieldKey: "sex", value: "female", status: "confirmed", lastVerifiedOn: "2026-07-04", conclusionVersion: 1 },
      { fieldKey: "birth_date", value: "2020-07-04", status: "confirmed", lastVerifiedOn: "2026-07-04", conclusionVersion: 1 },
      {
        fieldKey: "local.lifetime_adoption_name",
        value: { name: "Si Bao / 思宝", adopter: "Guangdong Sibao" },
        status: "confirmed",
        lastVerifiedOn: "2026-07-04",
        conclusionVersion: 1,
      },
      {
        fieldKey: "local.institutional_identifying_features",
        value: {
          features: [
            "dense black eye patches wider above and narrower below",
            "slightly pointed muzzle",
            "short and round body",
            "untranslated raw feature phrase",
          ],
        },
        status: "confirmed",
        lastVerifiedOn: "2026-07-04",
        conclusionVersion: 1,
      },
      {
        fieldKey: "local.bite_force_feeding_adjustment",
        value: { adjustment: "food cut into smaller pieces", bite_force: "lower" },
        status: "confirmed",
        lastVerifiedOn: "2026-07-04",
        conclusionVersion: 1,
      },
      {
        fieldKey: "local.hind_limb_exercise_support",
        value: { method: "food suspended from a long pole" },
        status: "confirmed",
        lastVerifiedOn: "2026-07-04",
        conclusionVersion: 1,
      },
    ]);

    const rich = extractRichFacts({
      panda: heHua,
      birthPlace: null,
      currentPlace: { short: "成都", sub: "成都大熊猫基地" },
      currentPlaceFull: "成都大熊猫基地",
      placesLived: [],
      canonicalMotherName: "成功",
      today: "2026-11-24",
    });

    expect(rich.adoptionName).toBe("思宝");
    expect(rich.traits?.pills).toEqual(["眼斑上宽下窄", "嘴筒微尖", "体态短圆"]);
    expect(rich.traits?.careNote).toBe("咬合力偏弱，食物通常会切成小块；平时也会通过长杆吊挂食物鼓励站立与锻炼后肢。");
    expect(JSON.stringify(rich.traits)).not.toContain("untranslated");
    expect(rich.recommendedArticleSlug).toBe("telling-faces-apart");
  });

  it("returns null leadBio and lifeStage for completely sparse or deceased pandas", () => {
    const empty = extractRichFacts({
      panda: panda("sparse", "选项乙", []),
      birthPlace: null,
      currentPlace: null,
      currentPlaceFull: null,
      placesLived: [],
      canonicalMotherName: null,
      today: "2026-11-24",
    });
    expect(empty.leadBio).toBeNull();
    expect(empty.lifeStage).toBeNull();
    expect(empty.highlights).toEqual([]);

    expect(computeLifeStage("1986-09-04", true, "2026-11-24")).toBeNull();
    expect(computeLifeStage("2020-11-24", false, "2026-11-24")?.countdownText).toBe("今天 6 岁生日");
  });
});
