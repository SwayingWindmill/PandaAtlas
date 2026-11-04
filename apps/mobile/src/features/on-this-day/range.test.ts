import { describe, expect, it } from "vitest";

import { rangeDays, sentenceOn, whenLine } from "./range";

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

describe("whenLine", () => {
  it("names the day and the years, but not for a birthday, which already says them", () => {
    expect(whenLine({ years: 27, kind: "arrival" }, "2026-11-05", "2026-11-04")).toBe("11月5日 周四 · 27 周年");
    expect(whenLine({ years: 3, kind: "home" }, "2026-11-04", "2026-11-04")).toBe("今天 · 3 周年");
    expect(whenLine({ years: 6, kind: "birthday" }, "2026-11-08", "2026-11-04")).toBe("11月8日 周日");
  });
});
