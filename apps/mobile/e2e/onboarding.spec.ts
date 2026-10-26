import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";
import { enterCode, testEmail } from "./session";

// A fresh install: no welcome flag on the device.
test.use({ storageState: { cookies: [], origins: [] } });

test("first launch welcomes the fan, who signs in, follows two pandas and lands on 今天", async ({ page }) => {
  const { panda, notice } = fixture();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "先关注几只熊猫" })).toBeVisible();

  for (const name of [panda.name, notice.name]) {
    await page.getByLabel("搜索想关注的熊猫").fill(name);
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("button", { name, exact: true, pressed: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "登录并关注这 2 只" }).click();
  await enterCode(page, testEmail("welcome"));
  await page.getByRole("button", { name: "关注这 2 只" }).click();
  await expect(page.getByRole("heading", { name: "今天", exact: true })).toBeVisible();

  await page.goto("/me");
  await expect(page.getByRole("heading", { name: /^关注的熊猫\s+2$/ })).toBeVisible();
});

test("skipping the welcome shows it only once", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "先逛逛" }).click();
  await expect(page.getByRole("heading", { name: "今天", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "今天", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "先关注几只熊猫" })).toHaveCount(0);
});
