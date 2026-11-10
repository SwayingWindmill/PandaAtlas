// Renders the app icon, the Android adaptive icon layers, the splash marks and the web favicon from the
// approved brand mark (apps/web/public/brand/zhipanda-mark-approved.svg), so every launcher and launch
// screen shows the resting panda. Black and white by brand rule: ink on white, white on black in dark.
// Run from apps/mobile: node scripts/app-icons.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirOf = (relative) => fileURLToPath(new URL(relative, import.meta.url)) + path.sep;
const out = dirOf("../assets/images/");
const svg = fs.readFileSync(dirOf("../../web/public/brand/") + "zhipanda-mark-approved.svg", "utf8");
const INK = "#0a0a0a";
const WHITE = "#ffffff";

/**
 * Each image: its square-ish canvas, the ground (none for a transparent layer), the mark's color and the
 * share of the canvas width the mark spans. Android crops an adaptive layer to the middle 66 of 108, so
 * its mark stays inside that circle.
 */
const images = {
  "icon.png": { width: 1024, height: 1024, ground: WHITE, mark: INK, span: 0.72 },
  "android-icon-background.png": { width: 512, height: 512, ground: WHITE, mark: null, span: 0 },
  "android-icon-foreground.png": { width: 512, height: 512, ground: null, mark: INK, span: 0.5 },
  "android-icon-monochrome.png": { width: 512, height: 512, ground: null, mark: INK, span: 0.5 },
  "splash-icon.png": { width: 600, height: 334, ground: null, mark: INK, span: 1 },
  "splash-icon-dark.png": { width: 600, height: 334, ground: null, mark: WHITE, span: 1 },
  "favicon.png": { width: 48, height: 48, ground: null, mark: INK, span: 0.94 },
};

const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || (process.platform === "win32" ? "msedge" : undefined);
const browser = await chromium.launch(channel ? { channel } : {});
for (const [name, { width, height, ground, mark, span }] of Object.entries(images)) {
  const page = await browser.newPage({ viewport: { width, height } });
  const drawn = mark ? svg.replace("<svg ", `<svg style="width:${span * 100}%;color:${mark}" `) : "";
  await page.setContent(
    `<html><body style="margin:0;width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;background:${ground ?? "transparent"}">${drawn}</body></html>`,
  );
  await page.screenshot({ path: out + name, omitBackground: ground === null });
  await page.close();
}
await browser.close();
