import process from "node:process";

import { chromium, firefox, webkit } from "@playwright/test";

const browserMatrix = process.env.PLAYWRIGHT_BROWSER_MATRIX === "1";
const configuredChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || undefined;
const channel = configuredChannel
  ?? (
    !browserMatrix
    && process.platform === "win32"
    && process.env.RELEASE_GATE_USE_SYSTEM_EDGE !== "0"
      ? "msedge"
      : undefined
  );
const runtimes = channel
  ? [{ name: channel, type: chromium, launchOptions: { channel } }]
  : browserMatrix
    ? [
        { name: "chromium", type: chromium, launchOptions: {} },
        { name: "firefox", type: firefox, launchOptions: {} },
        { name: "webkit", type: webkit, launchOptions: {} },
      ]
    : [{ name: "bundled-chromium", type: chromium, launchOptions: {} }];

try {
  for (const runtime of runtimes) {
    const browser = await runtime.type.launch({
      ...runtime.launchOptions,
      headless: true,
    });
    await browser.close();
    console.log(`PLAYWRIGHT_RUNTIME_RESULT status=passed browser=${runtime.name}`);
  }
} catch (error) {
  console.error(
    `PLAYWRIGHT_RUNTIME_RESULT status=environment-blocked reason=${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 2;
}
