import process from "node:process";

import { chromium } from "@playwright/test";

const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || undefined;

try {
  const browser = await chromium.launch({
    channel,
    headless: true,
  });
  await browser.close();
  console.log(`PLAYWRIGHT_RUNTIME_RESULT status=passed browser=${channel ?? "bundled-chromium"}`);
} catch (error) {
  console.error(
    `PLAYWRIGHT_RUNTIME_RESULT status=environment-blocked browser=${channel ?? "bundled-chromium"} reason=${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 2;
}
