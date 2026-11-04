import { describe, expect, it } from "vitest";

import { datePart, rangeDays, sentenceOn, titleOn, yearsPart } from "./range";

describe("rangeDays", () => {
  it("takes today and the next six days for 本周", () => {
    expect(rangeDays("2026-11-04", "week")).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
      "2026-11-09",
      "2026-11-10",
    ]);
  });

  it("runs from today to the month's last day for 本月", () => {
    const days = rangeDays("2026-11-04", "month");
    expect(days[0]).toBe("2026-11-04");
    expect(days.at(-1)).toBe("2026-11-30");
    expect(days).toHaveLength(27);
    expect(rangeDays("2026-12-31", "month")).toEqual(["2026-12-31"]);
  });
});

describe("sentenceOn", () => {
  it("keeps the sentence on today and drops 'N 年前的今天' on another day", () => {
    expect(sentenceOn({ text: "3 年前的今天回国，住进雅安碧峰峡基地" }, "2026-11-04", "2026-11-04")).toBe("3 年前的今天回国，住进雅安碧峰峡基地");
    expect(sentenceOn({ text: "3 年前的今天回国，住进雅安碧峰峡基地" }, "2026-11-08", "2026-11-04")).toBe("回国，住进雅安碧峰峡基地");
    expect(sentenceOn({ text: "2 年前的今天，你在史密森国家动物园见过它" }, "2026-11-08", "2026-11-04")).toBe("你在史密森国家动物园见过它");
    expect(sentenceOn({ text: "今天满月" }, "2026-11-08", "2026-11-04")).toBe("满月");
    expect(sentenceOn({ text: "6 岁生日" }, "2026-11-08", "2026-11-04")).toBe("6 岁生日");
  });
});

describe("titleOn", () => {
  const panda = (name: string) => ({ kind: "panda" as const, key: name, id: name, slug: name, name });
  it("says who the memory is about", () => {
    expect(titleOn({ text: "3 年前的今天回国，住进雅安碧峰峡基地", subject: panda("美香") }, "2026-11-08", "2026-11-04")).toBe("美香回国，住进雅安碧峰峡基地");
    expect(titleOn({ text: "6 岁生日", subject: panda("宝力") }, "2026-11-08", "2026-11-04")).toBe("宝力 6 岁生日");
    expect(titleOn({ text: "2 年前的今天，你在史密森国家动物园见过它", subject: panda("宝力") }, "2026-11-08", "2026-11-04")).toBe("你在史密森国家动物园见过宝力");
  });
});

describe("datePart and yearsPart", () => {
  it("dates the row and counts an anniversary, not a birthday", () => {
    expect(datePart({ date: "1999-11-05" }, "2026-11-05")).toBe("11.05 · 1999");
    expect(yearsPart({ years: 27, kind: "arrival" })).toBe("27 周年");
    expect(yearsPart({ years: 6, kind: "birthday" })).toBeNull();
  });
});
