import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: {},
}));

import { normalizeTerm, type PandaListItem } from "@/features/pandas/pandas";

import { filterResidents, splitResidentsByCover } from "./resident-filter";

function samplePanda(overrides: Partial<PandaListItem>): PandaListItem {
  const name = overrides.name ?? "和花";
  const slug = overrides.slug ?? "he-hua";
  return {
    id: overrides.id ?? slug,
    slug,
    name,
    sex: "female",
    birthDate: "2020-07-04",
    deceased: false,
    place: "成都基地",
    placeId: "place-cd",
    area: "成都",
    hasFullBleedCover: true,
    terms: [slug, name, "成都基地"].map(normalizeTerm),
    initials: ["hh"],
    ...overrides,
  };
}

describe("resident-filter", () => {
  const hehua = samplePanda({ id: "p-1", slug: "he-hua", name: "和花", hasFullBleedCover: true, initials: ["hh"] });
  const hefeng = samplePanda({ id: "p-2", slug: "he-feng", name: "和风", hasFullBleedCover: true, initials: ["hf"] });
  const keke = samplePanda({ id: "p-3", slug: "ke-ke", name: "可可", hasFullBleedCover: false, initials: ["kk"] });
  const pandas = [hehua, hefeng, keke];

  it("searches residents by Chinese name and pinyin initials", () => {
    expect(filterResidents(pandas, "和花", "all", null, null).map((p) => p.id)).toEqual(["p-1"]);
    expect(filterResidents(pandas, "hf", "all", null, null).map((p) => p.id)).toEqual(["p-2"]);
    expect(filterResidents(pandas, "", "all", null, null).map((p) => p.id)).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("filters by unseen and followed sets and handles null gracefully", () => {
    const seen = new Set(["p-1"]);
    const followed = new Set(["p-1", "p-3"]);
    expect(filterResidents(pandas, "", "unseen", seen, followed).map((p) => p.id)).toEqual(["p-2", "p-3"]);
    expect(filterResidents(pandas, "", "followed", seen, followed).map((p) => p.id)).toEqual(["p-1", "p-3"]);
    expect(filterResidents(pandas, "", "unseen", null, null).map((p) => p.id)).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("partitions full-bleed covers ahead of compact rows", () => {
    const split = splitResidentsByCover(pandas);
    expect(split.featured.map((p) => p.id)).toEqual(["p-1", "p-2"]);
    expect(split.compact.map((p) => p.id)).toEqual(["p-3"]);
  });
});
