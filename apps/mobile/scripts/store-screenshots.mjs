// Store screenshots of six core screens, light and dark, at the sizes App Store Connect and Google Play ask for.
// It drives the app's web build with production's public data, the same build the verify skill's preview uses:
//   node apps/mobile/scripts/preview-production.mjs          (in another terminal, until http://localhost:8796 answers)
//   npm run store:screenshots -w @zhipanda/mobile [-- --panda <slug> --venue <slug> --only <device>]
// Output: apps/mobile/store-screenshots/<device>/<theme>/<nn>-<screen>.png (git-ignored).
// It is the web rendering: no iOS status bar, and native-only parts (maps, share sheets) look as they do on the web.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright-core";

const { values: flags } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:8796" },
    panda: { type: "string", default: "mei-xiang" },
    venue: { type: "string", default: "chengdu-research-base" },
    only: { type: "string" },
  },
});

// Logical size × scale = the pixel size each store accepts.
const DEVICES = {
  "iphone-6.9": { width: 440, height: 956, scale: 3 }, // 1320 × 2868
  "iphone-6.5": { width: 414, height: 896, scale: 3 }, // 1242 × 2688
  "ipad-13": { width: 1032, height: 1376, scale: 2 }, // 2064 × 2752
  "android-phone": { width: 360, height: 640, scale: 3 }, // 1080 × 1920
};

const SCREENS = [
  { name: "today", route: "/" },
  { name: "discover", route: "/discover" },
  { name: "find", route: "/find" },
  { name: "panda", route: `/pandas/${flags.panda}` },
  { name: "family", route: `/pandas/${flags.panda}/family` },
  { name: "venue", route: `/institutions/${flags.venue}` },
];

const THEMES = ["light", "dark"];
const outRoot = path.resolve(import.meta.dirname, "../store-screenshots");

async function reachable(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(10_000) })).ok;
  } catch {
    return false;
  }
}

/**
 * Waits until the images on screen stop changing and have all loaded, so no tile is caught half-drawn.
 * Network idle alone fires before the queries render their <img> tags.
 */
async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
  await page
    .waitForFunction(
      () => {
        // Lazy images below the fold never load without a scroll, and a screenshot does not show them.
        const images = [...document.images].filter((image) => {
          const rect = image.getBoundingClientRect();
          return rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        });
        const key = images.map((image) => image.src).join("|");
        const state = (window.__storeSettle ??= { key: "", since: Date.now() });
        if (state.key !== key) Object.assign(state, { key, since: Date.now() });
        // A screen with no photo in view (the map on a small phone) gets longer to prove nothing is coming.
        const quiet = Date.now() - state.since;
        return images.every((image) => image.complete) && (images.length > 0 ? quiet > 2000 : quiet > 8000);
      },
      undefined,
      { timeout: 45_000, polling: 250 },
    )
    .catch(() => console.warn(`[store-screenshots] ${page.url()}: images still loading after 45 s; shooting anyway`));
  // Entrance animations run about 300 ms; give them room to finish.
  await page.waitForTimeout(1500);
}

if (!(await reachable(flags.base))) {
  console.error(`[store-screenshots] ${flags.base} does not answer. Start node apps/mobile/scripts/preview-production.mjs first.`);
  process.exit(1);
}

const devices = Object.entries(DEVICES).filter(([name]) => !flags.only || name === flags.only);
if (devices.length === 0) {
  console.error(`[store-screenshots] --only must be one of ${Object.keys(DEVICES).join(", ")}`);
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome" });
let count = 0;
try {
  for (const [device, size] of devices) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.scale,
        isMobile: device !== "ipad-13",
        hasTouch: true,
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        colorScheme: theme,
      });
      // A returning fan: past the first-launch welcome.
      await context.addInitScript(() => localStorage.setItem("welcome.seen", "1"));
      const page = await context.newPage();
      const dir = path.join(outRoot, device, theme);
      fs.mkdirSync(dir, { recursive: true });
      for (const [index, screen] of SCREENS.entries()) {
        await page.goto(flags.base + screen.route, { timeout: 120_000 });
        const started = Date.now();
        await settle(page);
        const file = path.join(dir, `${String(index + 1).padStart(2, "0")}-${screen.name}.png`);
        await page.screenshot({ path: file });
        count += 1;
        console.log(`[store-screenshots] ${path.relative(outRoot, file)} (${Math.round((Date.now() - started) / 1000)} s)`);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`[store-screenshots] ${count} screenshots in ${outRoot}`);
