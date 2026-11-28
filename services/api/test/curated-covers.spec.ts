import { describe, expect, it } from "vitest";

import { hasBurnedInMark, isFullBleedCoverReady } from "../src/modules/public-read/application/curated-covers.js";

describe("hasBurnedInMark", () => {
  it("flags covers credited to Xinhua, in English or Chinese", () => {
    expect(hasBurnedInMark({ creator: "Xinhua via People's Daily Online", attributionText: null })).toBe(true);
    expect(hasBurnedInMark({ creator: null, attributionText: "照片 新华社" })).toBe(true);
  });

  it("flags Pandapia's logo-stamped crops", () => {
    expect(hasBurnedInMark({ creator: "Pandapia", attributionText: "Pandapia" })).toBe(true);
  });

  it("keeps other credits and covers without one", () => {
    expect(hasBurnedInMark({ creator: "Smithsonian's National Zoo", attributionText: "CC BY 4.0" })).toBe(false);
    expect(hasBurnedInMark({})).toBe(false);
  });
});

describe("isFullBleedCoverReady", () => {
  const curated = new Map([["a", "0123456789abcdef"]]);

  it("accepts only the reviewed photo of a reviewed panda", () => {
    expect(isFullBleedCoverReady({ pandaId: "a", contentSha256: `0123456789abcdef${"0".repeat(48)}` }, curated)).toBe(true);
    expect(isFullBleedCoverReady({ pandaId: "b", contentSha256: `0123456789abcdef${"0".repeat(48)}` }, curated)).toBe(false);
  });

  it("drops a panda whose cover was replaced after the review", () => {
    expect(isFullBleedCoverReady({ pandaId: "a", contentSha256: "f".repeat(64) }, curated)).toBe(false);
  });

  it("rejects watermarked credits even when hash matches", () => {
    expect(
      isFullBleedCoverReady(
        { pandaId: "a", contentSha256: `0123456789abcdef${"0".repeat(48)}`, creator: "新华社" },
        curated,
      ),
    ).toBe(false);
  });

  it("leaves out the reported thumbnail and colour-cast covers", () => {
    // 雪雪's 152x180 thumbnail with her name and a grey frame; 桃苏's blue-cast photo.
    expect(isFullBleedCoverReady({ pandaId: "d3ca0021-b582-53b1-a6c1-8d89354131cf", contentSha256: "0".repeat(64) })).toBe(false);
    expect(isFullBleedCoverReady({ pandaId: "d90aafd8-7759-58b0-8216-7e5c272b01cc", contentSha256: "0".repeat(64) })).toBe(false);
  });
});
