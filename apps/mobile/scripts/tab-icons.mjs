// Rasterizes the four Lucide tab glyphs to template PNGs (@1x/@2x/@3x, 25pt, stroke 1.9).
// The native tab bar takes images, not components. Run from apps/mobile: node scripts/tab-icons.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
const root = new URL("../../../node_modules/lucide-react-native/dist/esm/icons/", import.meta.url).pathname;
const out = new URL("../assets/tab-icons/", import.meta.url).pathname;
const icons = { today: "sun", search: "search", atlas: "layout-grid", me: "user-round" };
const browser = await chromium.launch();
for (const [name, file] of Object.entries(icons)) {
  const src = fs.readFileSync(root + file + ".mjs", "utf8");
  const node = eval(src.match(/node: (\[[\s\S]*?\n  \])/)[1].replace(/key: "[^"]*"/g, ""));
  const body = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  for (const scale of [1, 2, 3]) {
    const page = await browser.newPage({ viewport: { width: 25, height: 25 }, deviceScaleFactor: scale });
    await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg></body></html>`);
    await page.locator("svg").screenshot({ path: `${out}${name}${scale === 1 ? "" : `@${scale}x`}.png`, omitBackground: true });
    await page.close();
  }
}
await browser.close();
