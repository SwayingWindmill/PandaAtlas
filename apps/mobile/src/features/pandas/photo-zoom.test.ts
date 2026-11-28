import { describe, expect, it } from "vitest";

import {
  DOUBLE_TAP_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  clampPan,
  clampZoom,
  parsePhotoIndex,
  touchDistance,
} from "./photo-zoom";

describe("photo-zoom", () => {
  it("clamps zoom scale cleanly between 1x and 3x", () => {
    expect(clampZoom(0.4)).toBe(MIN_ZOOM);
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(DOUBLE_TAP_ZOOM)).toBe(DOUBLE_TAP_ZOOM);
    expect(clampZoom(5.5)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });

  it("clamps pan offset proportionally to zoom scale and viewport", () => {
    expect(clampPan(50, 1, 390)).toBe(0);
    expect(clampPan(-50, 1, 390)).toBe(0);
    // 2.2x on 400px -> max offset = (1.2 * 400) / 2 = 240
    expect(clampPan(180, 2.2, 400)).toBe(180);
    expect(clampPan(300, 2.2, 400)).toBeCloseTo(240, 5);
    expect(clampPan(-300, 2.2, 400)).toBeCloseTo(-240, 5);
    expect(clampPan(100, 2, 0)).toBe(0);
  });

  it("parses clicked photo index safely into bounds", () => {
    expect(parsePhotoIndex("2", 5)).toBe(2);
    expect(parsePhotoIndex(["3", "1"], 5)).toBe(3);
    expect(parsePhotoIndex("99", 5)).toBe(4);
    expect(parsePhotoIndex("-2", 5)).toBe(0);
    expect(parsePhotoIndex("abc", 5)).toBe(0);
    expect(parsePhotoIndex(undefined, 5)).toBe(0);
    expect(parsePhotoIndex("2", 0)).toBe(0);
  });

  it("computes Euclidean pinch touch distance", () => {
    expect(touchDistance({ pageX: 0, pageY: 0 }, { pageX: 30, pageY: 40 })).toBe(50);
  });
});
