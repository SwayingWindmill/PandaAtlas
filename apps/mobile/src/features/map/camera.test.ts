import { WORLD_WIDTH, projectToWorld } from "@zhipanda/world-map";
import { describe, expect, it } from "vitest";

import { between, fitPoints, panBy, toScreen, zoomAt } from "./camera";

const viewport = { width: 390, height: 844, top: 100, bottom: 300 };
const sichuan = [projectToWorld(102.98, 30.07), projectToWorld(103.32, 31.1), projectToWorld(104.15, 30.73)];

describe("fitPoints", () => {
  it("puts every point inside the strip between the buttons and the sheet", () => {
    const camera = fitPoints(sichuan, viewport);
    for (const point of sichuan) {
      const screen = toScreen(point, camera, viewport);
      expect(screen.x).toBeGreaterThan(0);
      expect(screen.x).toBeLessThan(viewport.width);
      expect(screen.y).toBeGreaterThan(viewport.top);
      expect(screen.y).toBeLessThan(viewport.height - viewport.bottom);
    }
  });

  it("does not zoom to street level for points close together", () => {
    const one = fitPoints([sichuan[0]!], viewport);
    expect(one.scale).toBeLessThanOrEqual((viewport.width - 96) / 24);
  });

  it("shows the whole world when there is nothing to fit", () => {
    expect(fitPoints([], viewport).scale).toBeCloseTo(viewport.width / WORLD_WIDTH);
  });
});

describe("zoomAt", () => {
  it("keeps the point under the fingers in place", () => {
    const camera = fitPoints(sichuan, viewport);
    const anchor = toScreen(sichuan[1]!, camera, viewport);
    const zoomed = zoomAt(camera, 1.5, anchor, viewport);
    const after = toScreen(sichuan[1]!, zoomed, viewport);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });

  it("stops at the whole world when zooming out", () => {
    const camera = fitPoints(sichuan, viewport);
    expect(zoomAt(camera, 0.0001, { x: 0, y: 0 }, viewport).scale).toBeCloseTo(viewport.width / WORLD_WIDTH);
  });
});

it("moves the map with the finger", () => {
  const camera = fitPoints(sichuan, viewport);
  const before = toScreen(sichuan[0]!, camera, viewport);
  const after = toScreen(sichuan[0]!, panBy(camera, 30, -20, viewport), viewport);
  expect(after.x - before.x).toBeCloseTo(30);
  expect(after.y - before.y).toBeCloseTo(-20);
});

it("starts and ends a flight on its cameras", () => {
  const from = { x: 100, y: 100, scale: 1 };
  const to = { x: 700, y: 200, scale: 16 };
  expect(between(from, to, 0)).toEqual(from);
  const end = between(from, to, 1);
  expect(end.x).toBeCloseTo(to.x);
  expect(end.scale).toBeCloseTo(to.scale);
});
