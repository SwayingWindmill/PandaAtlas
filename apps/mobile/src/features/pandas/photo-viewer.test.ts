import { describe, expect, it } from "vitest";

import {
  ZOOM,
  anchoredTranslation,
  doubleTapTarget,
  fileName,
  fittedSize,
  pageAt,
  panLimit,
  restingScale,
  rubberBand,
  shareText,
} from "./photo-viewer";

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

describe("restingScale", () => {
  it("snaps a pinch that barely left 1x back to exactly 1x", () => {
    expect(restingScale(1.005)).toBe(1);
    expect(restingScale(ZOOM.zoomed)).toBe(1);
  });

  it("keeps a real zoom and pulls a stretched one back inside the bounds", () => {
    expect(restingScale(1.5)).toBe(1.5);
    expect(restingScale(5)).toBe(ZOOM.max);
    expect(restingScale(0.6)).toBe(ZOOM.min);
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
    expect((focal.x - at2.x) / 2).toBe(focal.x);
    expect((focal.y - at2.y) / 2).toBe(focal.y);
  });

  it("keeps the pinched point under the fingers when the pinch starts on an already zoomed photo", () => {
    const from = { x: -150, y: 0 };
    const centre = { x: 0, y: 0 };
    const at5 = anchoredTranslation(centre, centre, 2.5, from, 5);
    expect(at5).toEqual({ x: -300, y: 0 });
    expect((centre.x - from.x) / 2.5).toBe((centre.x - at5.x) / 5);

    const fingers = { x: 120, y: -60 };
    const moved = { x: 160, y: -20 };
    const atMoved = anchoredTranslation(moved, fingers, 2.5, from, 3);
    expect((moved.x - atMoved.x) / 3).toBeCloseTo((fingers.x - from.x) / 2.5);
    expect((moved.y - atMoved.y) / 3).toBeCloseTo((fingers.y - from.y) / 2.5);
  });

  it("zooms a double tap around the tapped point without opening a gap above a letterboxed photo", () => {
    const target = doubleTapTarget({ x: 100, y: 50 }, viewport, landscape);
    expect(target).toMatchObject({ scale: 2.5, x: -150 });
    expect(target.y).toBeCloseTo(0);
    expect(doubleTapTarget({ x: 190, y: 0 }, viewport, landscape).x).toBe(-285);
    expect(doubleTapTarget({ x: 400, y: 0 }, viewport, landscape).x).toBe(-300);
  });
});

describe("shared photo", () => {
  const photo = { id: "a1", url: "https://media.example/p/a1.JPG?w=2", credit: "照片 王小明 / CC BY 4.0，CC-BY-4.0", creator: null, source: null };

  it("sends the panda's name and the credit as text", () => {
    expect(shareText(photo, "萌兰")).toBe("萌兰\n照片 王小明 / CC BY 4.0，CC-BY-4.0");
    expect(shareText({ ...photo, credit: null }, "萌兰")).toBe("萌兰");
  });

  it("carries the credit in a file name every file system accepts", () => {
    expect(fileName(photo, "萌兰")).toBe("萌兰 照片 王小明 CC BY 4.0，CC-BY-4.0.jpg");
    expect(fileName({ ...photo, credit: null, url: "https://media.example/p/a1" }, "")).toBe("a1.jpg");
  });

  const bytes = (text: string) => new TextEncoder().encode(text).length;

  it("caps a long CJK credit at 200 bytes, not 200 characters", () => {
    const name = fileName({ ...photo, credit: "熊".repeat(150) }, "萌兰");
    expect(name.endsWith(".jpg")).toBe(true);
    const stem = name.slice(0, -".jpg".length);
    expect(bytes(stem)).toBeLessThanOrEqual(200);
    expect(stem).toBe(`萌兰 ${"熊".repeat(64)}`);
  });

  it("never cuts an emoji in half at the cap", () => {
    const stem = fileName({ ...photo, credit: `${"a".repeat(190)}🐼🐼` }, "萌兰").slice(0, -".jpg".length);
    expect(stem).toBe(`萌兰 ${"a".repeat(190)}`);
    expect(bytes(`萌兰 ${"a".repeat(190)}🐼`)).toBeGreaterThan(200);
    expect(stem).not.toMatch(/[\uD800-\uDFFF]/);
  });

  it("drops characters that would break the file URI or the file system", () => {
    expect(fileName({ ...photo, credit: "#1 100% 熊猫\u0007\u001f图" }, "萌兰")).toBe("萌兰 1 100 熊猫 图.jpg");
  });
});
