import { describe, expect, it } from "vitest";

import { daySlots, hoursLabel, minutesOf, partOfDay, placeOnStrip, spanLabel, stripRange } from "./day-window";

const viewing = {
  active: [
    { start: "09:00", end: "11:00" },
    { start: "14:30", end: "16:30" },
  ],
};

describe("day window", () => {
  it("reads times and labels spans", () => {
    expect(minutesOf("14:30")).toBe(870);
    expect(spanLabel(viewing.active[0]!)).toBe("09:00–11:00");
  });

  it("spans at least 08–18 and widens to whole hours", () => {
    expect(stripRange(viewing.active)).toEqual({ from: 480, to: 1080 });
    expect(stripRange([{ start: "07:30", end: "19:10" }])).toEqual({ from: 360, to: 1200 });
  });

  it("places windows as fractions", () => {
    expect(placeOnStrip({ start: "08:00", end: "13:00" }, { from: 480, to: 1080 })).toEqual({ left: 0, width: 0.5 });
  });

  it("orders the day and names its half", () => {
    const slots = daySlots({ ...viewing, nap: { start: "12:00", end: "14:30" } });
    expect(slots.map((slot) => slot.kind)).toEqual(["active", "nap", "active"]);
    expect(partOfDay(viewing.active[0]!)).toBe("上午");
    expect(partOfDay(viewing.active[1]!)).toBe("下午");
  });

  it("says whole hours plainly", () => {
    expect(hoursLabel({ start: "08:00", end: "12:00" })).toBe("8–12 点");
    expect(hoursLabel({ start: "08:30", end: "11:00" })).toBe("8:30–11 点");
  });
});
