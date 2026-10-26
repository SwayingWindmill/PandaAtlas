import { expect, test } from "@playwright/test";

import { runScheduledCycles } from "./backend";
import { fixture } from "./fixture";
import { signIn, testEmail } from "./session";

test("signed out, 今天 explains what following brings", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("登录并关注熊猫后，它们的新资料会出现在这里。")).toBeVisible();
});

test("today lists what the latest release changed for a followed panda", async ({ page }) => {
  const { panda } = fixture();
  await signIn(page, testEmail("today"));
  await page.goto("/");
  await expect(page.getByText("还没有关注的熊猫。", { exact: false })).toBeVisible();

  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: `关注${panda.name}` }).click();
  await expect(page.getByRole("button", { name: `已关注${panda.name}，点按取消` })).toBeVisible();

  // The fixture release is projected into the updates feed by the scheduled cycle.
  await runScheduledCycles();
  await page.goto("/");
  // e2e/global-setup.ts publishes the panda with its parents in this run's release.
  const row = page.getByRole("button", { name: new RegExp(`^${panda.name}，新收录、家谱有新记录，`) });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: panda.name })).toBeVisible();
});
