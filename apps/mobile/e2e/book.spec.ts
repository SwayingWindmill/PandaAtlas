import { expect, test } from "@playwright/test";

import { fixture, todayLabel } from "./fixture";
import { signIn, testEmail } from "./session";

test("signed out, the 图鉴 says what signing in keeps", async ({ page }) => {
  await page.goto("/book");
  await expect(page.getByText("你的熊猫清单")).toBeVisible();
  await expect(page.getByRole("button", { name: "先去猜今天的每日一猫" })).toBeVisible();
});

test("a panda marked 见过 lights up in the 图鉴", async ({ page }) => {
  const { panda } = fixture();
  await signIn(page, testEmail("book"));
  await page.goto("/book");
  await expect(page.getByLabel(/^点亮 0 只，共收录 [\d,]+ 只，0%$/)).toBeVisible();
  await expect(page.getByText("从第一只开始")).toBeVisible();

  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: `记下见过${panda.name}` }).click();
  await expect(page.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await page.goto("/book");
  await expect(page.getByLabel(/^点亮 1 只，共收录 [\d,]+ 只，\d+%$/)).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`^No\\.1，${panda.name}，${todayLabel()}.*见过$`) })).toBeVisible();
  await page.getByRole("radio", { name: "认出" }).click();
  await expect(page.getByRole("link", { name: new RegExp(`^No\\.1，${panda.name}`) })).toHaveCount(0);
});
