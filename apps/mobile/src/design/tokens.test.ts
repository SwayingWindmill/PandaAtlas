import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { applyCssBlock, applyFrontMatter } from "./generate";
import { type ColorRole, colorRoleNotes, concentric, primitive, semantic } from "./tokens";

const app = resolve(__dirname, "../..");

describe("generated files", () => {
  it("global.css matches tokens.ts (run `npm run design:tokens -w @zhipanda/mobile`)", () => {
    const css = readFileSync(resolve(app, "src/global.css"), "utf8");
    expect(applyCssBlock(css)).toBe(css);
  });

  it("DESIGN.md front matter matches tokens.ts (run `npm run design:tokens -w @zhipanda/mobile`)", () => {
    const md = readFileSync(resolve(app, "../../DESIGN.md"), "utf8");
    expect(applyFrontMatter(md)).toBe(md);
  });
});

/** WCAG 2 contrast ratio between two opaque hex colors. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("tokens", () => {
  it("gives every color role a note and both appearances", () => {
    for (const role of Object.keys(semantic.color.light) as ColorRole[]) {
      expect(colorRoleNotes[role]).toBeTruthy();
      expect(semantic.color.dark[role]).toBeTruthy();
    }
  });

  it.each(["light", "dark"] as const)("keeps text colors at AA on their grounds (%s)", (scheme) => {
    const c = semantic.color[scheme];
    for (const ground of [c.groupedBackground, c.card]) {
      expect(contrast(c.label, ground)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.secondaryLabel, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.tint, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.warm, ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(c.warm, c.warmSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.buttonLabel, c.button)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.tint, c.highlightSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps spacing on the 4pt grid", () => {
    for (const value of Object.values(primitive.space)) expect(value % 4).toBe(0);
    for (const { value } of Object.values(semantic.spacing)) expect(value % 4).toBe(0);
  });

  it("nests radii concentrically", () => {
    expect(concentric(semantic.radius.card.value, 16)).toBe(8);
    expect(concentric(semantic.radius.tile.value, 12)).toBe(4);
    expect(concentric(8, 12)).toBe(0);
  });

  it("never sets text below footnote", () => {
    for (const style of [...Object.values(semantic.text), ...Object.values(semantic.reading)]) {
      expect(style.size).toBeGreaterThanOrEqual(13);
      expect(style.lineHeight).toBeGreaterThan(style.size);
    }
  });
});
