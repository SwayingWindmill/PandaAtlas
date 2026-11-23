import { describe, expect, it } from "vitest";

import { ZOOM, anchoredTranslation, doubleTapTarget, fittedSize, pageAt, panLimit, rubberBand } from "./photo-viewer";

describe("pageAt", () => {
  it("rounds to the nearest whole page and stays inside the list", () => {
    expect(pageAt(780, 390, 5)).toBe(2);
    expect(pageAt(390 * 2 + 200, 390, 5)).toBe(3);
    expect(pageAt(-40, 390, 5)).toBe(0);
    expect(pageAt(390 * 9, 390, 5)).toBe(4);
  });

  it("reads the wrong page when an old offset meets a new width, which is why the pager re-scrolls", () => {
    expect(pageAt(780, 844, 5)).toBe(1);
    expect(pageAt(2 * 844, 844, 5)).toBe(2);
  });

  it("has no page before the pager has a width", () => {
    expect(pageAt(500, 0, 5)).toBe(0);
  });
});

describe("rubberBand", () => {
  it("leaves values inside the bounds alone", () => {
    expect(rubberBand(2, ZOOM.min, ZOOM.max, 1)).toBe(2);
  });

  it("moves less past a bound and never more than one dimension beyond it", () => {
    const past = rubberBand(5, ZOOM.min, ZOOM.max, 1);
    expect(past).toBeGreaterThan(4);
    expect(past).toBeLessThan(5);
    expect(rubberBand(1000, ZOOM.min, ZOOM.max, 1)).toBeLessThan(5);
    const under = rubberBand(0.5, ZOOM.min, ZOOM.max, 1);
    expect(under).toBeLessThan(1);
    expect(under).toBeGreaterThan(0.5);
  });
});

describe("zoom geometry", () => {
  const viewport = { width: 400, height: 800 };
  const landscape = fittedSize(viewport, { width: 4000, height: 3000 });

  it("fits a landscape photo to the width", () => {
    expect(landscape).toEqual({ width: 400, height: 300 });
    expect(fittedSize(viewport, null)).toEqual(viewport);
  });

  it("cannot pan at 1x, and pans only as far as the zoomed edge", () => {
    expect(panLimit(1, viewport, landscape)).toEqual({ x: 0, y: 0 });
    expect(panLimit(4, viewport, landscape)).toEqual({ x: 600, y: 200 });
  });

  it("keeps the pinched point under the fingers", () => {
    const focal = { x: 100, y: -40 };
    const at2 = anchoredTranslation(focal, focal, 1, { x: 0, y: 0 }, 2);
    expect(at2).toEqual({ x: -100, y: 40 });
    // The image point under the fingers, (focal - translation) / scale, is the same before and after.
    expect((focal.x - at2.x) / 2).toBe(focal.x);
    expect((focal.y - at2.y) / 2).toBe(focal.y);
  });

  it("zooms a double tap around the tapped point without opening a gap above a letterboxed photo", () => {
    const target = doubleTapTarget({ x: 100, y: 50 }, viewport, landscape);
    expect(target).toMatchObject({ scale: 2.5, x: -150 });
    expect(target.y).toBeCloseTo(0);
    expect(doubleTapTarget({ x: 190, y: 0 }, viewport, landscape).x).toBe(-285);
    expect(doubleTapTarget({ x: 400, y: 0 }, viewport, landscape).x).toBe(-300);
  });
});
