import { describe, expect, it } from "vitest";

import { PANDA_SOUND_CLIPS, VOCALIZATION_GUIDE } from "./catalog";

describe("panda sound catalog", () => {
  it("contains 5 verified clips with unique ids, valid durations, and attribution links", () => {
    expect(PANDA_SOUND_CLIPS).toHaveLength(5);
    const ids = new Set(PANDA_SOUND_CLIPS.map((clip) => clip.id));
    expect(ids.size).toBe(5);
    for (const clip of PANDA_SOUND_CLIPS) {
      expect(clip.durationSec).toBeGreaterThan(0);
      expect(clip.pageUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(clip.waveform.length).toBeGreaterThanOrEqual(16);
    }
  });

  it("links only valid clip ids inside the vocalization reference guide", () => {
    const validIds = new Set(PANDA_SOUND_CLIPS.map((clip) => clip.id));
    for (const entry of VOCALIZATION_GUIDE) {
      if (entry.linkedClipId) expect(validIds.has(entry.linkedClipId)).toBe(true);
    }
  });
});
