import { describe, expect, it } from "vitest";

import { qrCode, qrModules } from "./qr";

const PROFILE = "https://www.zhipanda.com/zh/pandas/he-hua-chengdu";

function at(modules: Uint8Array, size: number, x: number, y: number) {
  return modules[y * size + x];
}

describe("qrModules", () => {
  it("is a square grid", () => {
    const { size, modules } = qrModules(PROFILE);
    expect(size * size).toBe(modules.length);
    expect(size).toBeGreaterThanOrEqual(21);
    expect((size - 21) % 4).toBe(0);
  });

  it("sets the finder pattern in three corners and not the fourth", () => {
    const { size, modules } = qrModules(PROFILE);
    for (const [ox, oy] of [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ] as const) {
      expect(at(modules, size, ox, oy)).toBe(1);
      expect(at(modules, size, ox + 6, oy)).toBe(1);
      expect(at(modules, size, ox, oy + 6)).toBe(1);
      expect(at(modules, size, ox + 6, oy + 6)).toBe(1);
      expect(at(modules, size, ox + 3, oy + 3)).toBe(1);
      expect(at(modules, size, ox + 1, oy + 1)).toBe(0);
    }
  });

  it("gives the same output for the same input and a different one for another", () => {
    expect(qrModules(PROFILE)).toEqual(qrModules(PROFILE));
    expect(qrModules("https://www.zhipanda.com/zh/pandas/ueno-shinshin-cub-2012").modules).not.toEqual(qrModules(PROFILE).modules);
  });
});

describe("qrCode", () => {
  it("draws every dark module in one path", () => {
    const { size, modules } = qrModules(PROFILE);
    const { path } = qrCode(PROFILE);
    const runs = [...path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)];
    const covered = new Uint8Array(size * size);
    for (const [, x, y, w] of runs) {
      for (let i = 0; i < Number(w); i++) covered[Number(y) * size + Number(x) + i] = 1;
    }
    expect(covered).toEqual(modules);
    expect(runs.map((run) => run[0]).join("")).toBe(path);
  });
});
