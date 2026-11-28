import { describe, expect, it } from "vitest";

import { type TopicId, arrangeDiscover } from "./topics";

const only = (...ids: TopicId[]) => (id: TopicId) => ids.includes(id);
const DAYS = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"];
const leadName = (lead: ReturnType<typeof arrangeDiscover<string>>["lead"]) =>
  lead?.kind === "article" ? lead.article : lead?.topic.id;

describe("arrangeDiscover", () => {
  it("leaves out 专题 with nothing to show", () => {
    const { lead, rail } = arrangeDiscover<string>([], only("look-alikes"), "2026-11-10");
    expect(leadName(lead)).toBe("look-alikes");
    expect(rail).toEqual([]);
  });

  it("turns the lead over each day among articles and 专题", () => {
    const leads = DAYS.slice(0, 3).map((day) => leadName(arrangeDiscover(["eyes", "bamboo"], only("look-alikes"), day).lead));
    expect(new Set(leads)).toEqual(new Set(["eyes", "bamboo", "look-alikes"]));
  });

  it("keeps the leading 专题 out of the rail, and every 专题 in it on an article's day", () => {
    for (const day of DAYS) {
      const { lead, rail } = arrangeDiscover(["eyes"], () => true, day);
      const ids = rail.map((topic) => topic.id);
      if (lead?.kind === "topic") expect(ids).not.toContain(lead.topic.id);
      else expect(ids).toEqual(["returning", "look-alikes", "venue-news"]);
    }
  });

  it("has no lead when there is nothing to lead with", () => {
    expect(arrangeDiscover([], () => false, "2026-11-10")).toEqual({ lead: null, rail: [] });
  });
});
