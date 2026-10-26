import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";

// The fixture panda was born on 2020-07-20, so July 2026 shows its sixth birthday.
test("the calendar walks to July and opens a panda from its birthday", async ({ page }) => {
  const { panda } = fixture();
  await page.goto("/");
  await page.getByRole("link", { name: "看日历" }).click();
  const now = new Date();
  await expect(
    page.getByRole("heading", {
      name: `${now.getFullYear()}年${now.getMonth() + 1}月`,
    }),
  ).toBeVisible();

  const steps = (2026 - now.getFullYear()) * 12 + (7 - (now.getMonth() + 1));
  const button = page.getByRole("button", {
    name: steps < 0 ? "上个月" : "下个月",
  });
  for (let step = 0; step < Math.abs(steps); step += 1) await button.click();
  await expect(page.getByRole("heading", { name: "2026年7月" })).toBeVisible();

  await page.getByRole("button", { name: /^7月20日，\d+ 件$/ }).click();
  await expect(page.getByText("7月20日 周一")).toBeVisible();
  await page.getByRole("button", { name: `${panda.name}，6 岁生日` }).click();
  await expect(page.getByRole("heading", { name: panda.name })).toBeVisible();
});
