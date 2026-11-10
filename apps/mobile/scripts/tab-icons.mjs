// Rasterizes Lucide glyphs to template PNGs (@1x/@2x/@3x) for the native bars, which take images,
// not components: the five tab glyphs (25pt, stroke 1.9) and the header toolbar glyphs (22pt, stroke 2).
// It also writes each glyph as an SVG to assets/symbols/, which react-native-nano-icons turns into a
// custom SF Symbol (iOS) and a VectorDrawable (Android) at prebuild; Expo Go keeps the PNGs.
// Run from apps/mobile: node scripts/tab-icons.mjs
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** A folder next to this script as a native path ending in a separator; a URL's pathname breaks on Windows. */
const dirOf = (relative) => fileURLToPath(new URL(relative, import.meta.url)) + path.sep;
const root = dirOf("../../../node_modules/lucide-react-native/dist/esm/icons/");
const sets = [
  {
    out: "../assets/tab-icons/",
    size: 25,
    stroke: 1.9,
    icons: {
      today: "calendar",
      discover: "compass",
      search: "search",
      atlas: "book",
      me: "user-round",
    },
  },
  {
    out: "../assets/toolbar-icons/",
    size: 22,
    stroke: 2,
    icons: { share: "share", back: "chevron-left" },
  },
];
const symbols = dirOf("../assets/symbols/");
fs.mkdirSync(symbols, { recursive: true });
// The same browser rule as playwright.config.ts: Edge on Windows unless PLAYWRIGHT_BROWSER_CHANNEL says otherwise.
const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || (process.platform === "win32" ? "msedge" : undefined);
const browser = await chromium.launch(channel ? { channel } : {});
for (const { out: dir, size, stroke, icons } of sets) {
  const out = dirOf(dir);
  fs.mkdirSync(out, { recursive: true });
  for (const [name, file] of Object.entries(icons)) {
    const src = fs.readFileSync(root + file + ".mjs", "utf8");
    const node = eval(src.match(/\n  node: (\[[\s\S]*?\])(?=,?\n(?:  \w|\}))/)[1].replace(/key: "[^"]*"/g, ""));
    const body = node
      .map(
        ([tag, attrs]) =>
          `<${tag} ${Object.entries(attrs)
            .map(([k, v]) => `${k}="${v}"`)
            .join(" ")}/>`,
      )
      .join("");
    fs.writeFileSync(
      `${symbols}${name}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`,
    );
    for (const scale of [1, 2, 3]) {
      const page = await browser.newPage({
        viewport: { width: size, height: size },
        deviceScaleFactor: scale,
      });
      await page.setContent(
        `<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg></body></html>`,
      );
      await page.locator("svg").screenshot({
        path: `${out}${name}${scale === 1 ? "" : `@${scale}x`}.png`,
        omitBackground: true,
      });
      await page.close();
    }
  }
}
await browser.close();
