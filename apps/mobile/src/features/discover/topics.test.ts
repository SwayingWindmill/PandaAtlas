import { describe, expect, it } from "vitest";

import { type TopicId, arrangeTopics } from "./topics";

const only = (...ids: TopicId[]) => (id: TopicId) => ids.includes(id);
const ids = (topics: { id: TopicId }[]) => topics.map((topic) => topic.id);

describe("arrangeTopics", () => {
  it("leaves out topics with nothing to show", () => {
    const { hero, rail } = arrangeTopics(only("look-alikes", "map"), "2026-11-10");
    expect(hero?.id).toBe("look-alikes");
    expect(ids(rail)).toEqual(["map"]);
  });

  it("turns the featured topic over from one day to the next", () => {
    const has = only("returning", "look-alikes", "venue-news", "map");
    const heroes = ["2026-11-10", "2026-11-11", "2026-11-12"].map((day) => arrangeTopics(has, day).hero?.id);
    expect(new Set(heroes)).toEqual(new Set(["returning", "look-alikes", "venue-news"]));
  });

  it("keeps the featured topic out of the rail and the rest in order", () => {
    const { hero, rail } = arrangeTopics(() => true, "2026-11-10");
    expect(ids(rail)).not.toContain(hero!.id);
    expect(ids(rail).at(-1)).toBe("map");
  });

  it("never features 熊猫在哪里", () => {
    expect(arrangeTopics(only("map"), "2026-11-10")).toEqual({ hero: null, rail: [expect.objectContaining({ id: "map" })] });
  });
});
