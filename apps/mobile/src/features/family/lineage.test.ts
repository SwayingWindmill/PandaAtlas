import type { components } from "@zhipanda/api-client";
import { describe, expect, it } from "vitest";

import type { PandaListItem } from "@/features/pandas/pandas";

import { buildLineage } from "./lineage";

type Link = components["schemas"]["PublicLineageSummaryDto"];

function panda(id: string, sex: "male" | "female" | null, extra: Partial<PandaListItem> = {}): PandaListItem {
  return { id, slug: id, name: id, sex, birthDate: null, deceased: false, place: null, placeId: null, area: null, terms: [], ...extra };
}

const link = (childId: string, parentId: string, parentRole: Link["parentRole"], sourceIds = ["src"]): Link => ({
  assertionId: `${childId}-${parentRole}`,
  childId,
  parentId,
  parentRole,
  sourceIds,
});

/** The production lineage around Mei Xiang (release 2026.10.02.1-photo-only, read 2026-10-31). */
const PANDAS = new Map(
  [
    panda("tian-tian", "male", { place: "中国大熊猫保护研究中心" }),
    panda("mei-xiang", "female", { place: "中国大熊猫保护研究中心" }),
    panda("tai-shan", "male", { birthDate: "2005-07-09", place: "都江堰基地" }),
    panda("bao-bao", "female", { birthDate: "2013-08-23", place: "成都基地" }),
    panda("bei-bei", "male", { birthDate: "2015-08-22", place: "雅安基地" }),
    panda("xiao-qi-ji", "male", { birthDate: "2020-08-21", place: "卧龙" }),
    panda("bao-li", "male", { birthDate: "2021-08-04", place: "史密森国家动物园" }),
    panda("old-one", "female", { deceased: true, place: "成都基地" }),
  ].map((item) => [item.id, item]),
);
const LINKS = [
  ...["tai-shan", "bao-bao", "bei-bei", "xiao-qi-ji"].flatMap((child) => [
    link(child, "tian-tian", "father", ["src_smithsonian_agreement_2020"]),
    link(child, "mei-xiang", "mother", ["src_smithsonian_agreement_2020"]),
  ]),
  link("bao-li", "bao-bao", "mother", ["src_smithsonian_giant_panda_faq"]),
];

describe("buildLineage", () => {
  it("names grandparents by side and leaves an unknown father as a gap", () => {
    const lineage = buildLineage("bao-li", LINKS, PANDAS);
    const parents = lineage.groups.find((group) => group.generation === -1)!;
    expect(parents.members.map((kin) => kin.relation)).toEqual(["妈妈"]);
    expect(parents.missing).toBe(1);
    const grand = lineage.groups.find((group) => group.generation === -2)!;
    expect(grand.members.map((kin) => [kin.id, kin.relation])).toEqual([
      ["tian-tian", "外公"],
      ["mei-xiang", "外婆"],
    ]);
    // Only Bao Bao is known in the row below, and both her parents are on record.
    expect(grand.missing).toBe(0);
    expect(lineage.ancestorDepth).toBe(2);
    // Neither grandparent has parents on record: the great-grandparent row is a gap of four.
    expect(lineage.groups.find((group) => group.generation === -3)?.missing).toBe(4);
  });

  it("counts descendants and where the living ones are now", () => {
    const lineage = buildLineage("mei-xiang", LINKS, PANDAS);
    expect(lineage.descendantCount).toBe(5);
    const children = lineage.groups.find((group) => group.generation === 1)!;
    expect(children.members.map((kin) => kin.id)).toEqual(["tai-shan", "bao-bao", "bei-bei", "xiao-qi-ji"]);
    expect(lineage.groups.find((group) => group.generation === 2)?.members.map((kin) => kin.relation)).toEqual(["外孙"]);
    expect(lineage.descendantPlaces).toHaveLength(5);
    expect(lineage.descendantsUnplaced).toBe(0);
    expect(lineage.sourceIds).toEqual(["src_smithsonian_agreement_2020", "src_smithsonian_giant_panda_faq"]);
  });

  it("never draws a link without a source", () => {
    const lineage = buildLineage("bao-li", [...LINKS, link("bao-li", "tian-tian", "father", [])], PANDAS);
    expect(lineage.groups.find((group) => group.generation === -1)?.members.map((kin) => kin.id)).toEqual(["bao-bao"]);
  });

  it("leaves a deceased descendant out of where the family lives", () => {
    const lineage = buildLineage("bao-bao", [...LINKS, link("old-one", "bao-bao", "mother")], PANDAS);
    expect(lineage.descendantCount).toBe(2);
    expect(lineage.descendantPlaces).toEqual([{ place: "史密森国家动物园", count: 1 }]);
  });

  it("does not count the country as a place", () => {
    const pandas = new Map([...PANDAS, ["bao-li", panda("bao-li", "male", { place: "中国" })]]);
    const lineage = buildLineage("bao-bao", LINKS, pandas);
    expect(lineage.descendantPlaces).toEqual([]);
    expect(lineage.descendantsUnplaced).toBe(1);
  });

  it("goes three generations up and words the third through the second", () => {
    const pandas = new Map([...PANDAS, ["gg", panda("gg", "female")]]);
    const lineage = buildLineage("bao-li", [...LINKS, link("mei-xiang", "gg", "mother")], pandas);
    expect(lineage.groups.find((group) => group.generation === -3)?.members.map((kin) => kin.relation)).toEqual(["外婆的妈妈"]);
  });
});
