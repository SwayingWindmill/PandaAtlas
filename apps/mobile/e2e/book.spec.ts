import { expect, test } from "@playwright/test";

import { fixture, todayLabel } from "./fixture";
import { signIn, testEmail } from "./session";

test("signed out, the 图鉴 says what signing in keeps", async ({ page }) => {
  await page.goto("/book");
  await expect(page.getByText("登录后，这里会记下")).toBeVisible();
  await expect(page.getByRole("button", { name: "先去猜今天的每日一猫" })).toBeVisible();
});

test("a panda marked 见过 joins the 图鉴 with its day", async ({ page }) => {
  const { panda } = fixture();
  await signIn(page, testEmail("book"));
  await page.goto("/book");
  await expect(page.getByText("只已认识，共收录", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "0" })).toBeVisible();

  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: `记下见过${panda.name}` }).click();
  await expect(page.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await page.goto("/book");
  await expect(page.getByRole("heading", { name: "1" })).toBeVisible();
  const [month, day] = [new Date().getMonth() + 1, new Date().getDate()];
  await expect(page.getByRole("button", { name: `${panda.name}，${month}/${day} 去现场见过` })).toBeVisible();
});
