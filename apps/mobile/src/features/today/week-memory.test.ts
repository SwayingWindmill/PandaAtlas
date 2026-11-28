import { describe, expect, it } from "vitest";

import type { Memory } from "@/features/on-this-day/on-this-day";

import { weekMemory } from "./week-memory";

function memory(kind: Memory["kind"], id: string, years: number, extra: Partial<Memory> = {}): Memory {
  return {
    key: `${kind}:${id}`,
    kind,
    subject: { key: `panda:${id}`, kind: "panda", id, slug: id, name: id },
    date: "2023-11-08",
    years,
    text: "",
    sourceIds: ["s"],
    personal: false,
    deceased: false,
    ...extra,
  };
}

const day = (date: string, memories: Memory[]) => ({ date, memories });

describe("weekMemory", () => {
  it("is null for a week with nothing", () => {
    expect(weekMemory([day("2026-11-04", [])])).toBeNull();
  });

  it("takes the nearest day and tells the pandas of one kind together", () => {
    const hero = weekMemory([
      day("2026-11-04", []),
      day("2026-11-05", [memory("home", "mei-xiang", 3), memory("home", "tian-tian", 3), memory("birthday", "bao-li", 3)]),
      day("2026-11-06", [memory("birthday", "qing-bao", 4)]),
    ]);
    expect(hero).toMatchObject({ kind: "home", date: "2026-11-05", daysLeft: 1, title: "回国 3 周年", label: "那年今天" });
    expect(hero?.pandas.map((panda) => panda.id)).toEqual(["mei-xiang", "tian-tian"]);
  });

  it("calls a birthday 生日周 and skips the fan's own and the deceased", () => {
    const hero = weekMemory([
      day("2026-11-04", [memory("seen", "a", 1, { personal: true }), memory("arrival", "b", 2, { deceased: true })]),
      day("2026-11-05", [memory("birthday", "c", 6)]),
    ]);
    expect(hero).toMatchObject({ kind: "birthday", title: "6 岁生日", label: "生日周", daysLeft: 1 });
  });

  it("looks no further than seven days", () => {
    const days = Array.from({ length: 8 }, (_, index) => day(`2026-11-${String(4 + index).padStart(2, "0")}`, []));
    days[7] = day("2026-11-11", [memory("birthday", "late", 2)]);
    expect(weekMemory(days)).toBeNull();
  });
});
