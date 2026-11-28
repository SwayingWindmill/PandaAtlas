import { expect } from "e2e";

import { test } from "./support/test.ts";

/** The 外观 heading's text colour, which follows the theme. Runs in the page. */
function ink(): string {
  const heading = [...document.querySelectorAll("[role=heading], h1, h2")].find((node) => node.textContent?.trim() === "外观");
  return heading ? getComputedStyle(heading).color : "";
}

// e2e.config.ts reports a light system theme, so 深色 is a visible change of the screen's colours.
test("外观 switches the app to dark, stays dark after a restart, and follows the system again", async ({ app, screen, browser }) => {
  await app.open("/settings");
  await screen.getByRole("button", "外观，跟随系统").tap();
  await expect(screen.getByRole("heading", "外观")).toBeVisible();
  const light = await browser.evaluate(ink);

  await screen.getByRole("button", "深色").tap();
  await expect.poll(() => browser.evaluate(ink)).not.toBe(light);
  const dark = await browser.evaluate(ink);

  await browser.reload();
  await expect.poll(() => browser.evaluate(ink)).toBe(dark);

  await screen.getByRole("button", "跟随系统").tap();
  await expect.poll(() => browser.evaluate(ink)).toBe(light);
});

test("关于 shows what the published release holds", async ({ app, screen }) => {
  await app.open("/settings");
  await screen.getByRole("button", "数据来源").tap();
  await expect(screen.getByRole("heading", "内容和照片从哪来")).toBeVisible();
  await expect(screen.getByLabel(/^熊猫 [\d,]+ 只$/)).toBeVisible();
  await expect(screen.getByText("资料版本")).toBeVisible();
});
