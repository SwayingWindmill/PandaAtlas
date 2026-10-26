import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";
import { signIn, testEmail } from "./session";

test("signed out, 纠错 asks the fan to sign in first", async ({ page }) => {
  const { panda } = fixture();
  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: "资料有误？纠错" }).click();
  await expect(page.getByText("登录后才能纠错")).toBeVisible();
});

test("a signed-in fan reports a mistake with a source and follows it in 我的", async ({ page }) => {
  const { panda } = fixture();
  await signIn(page, testEmail("correct"));
  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: "资料有误？纠错" }).click();
  await expect(page.getByText(`纠错　${panda.name}`)).toBeVisible();

  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.getByText("选一项哪里不对。")).toBeVisible();

  await page.getByRole("radio", { name: "出生日期" }).click();
  await expect(page.getByRole("radio", { name: "出生日期", checked: true })).toBeVisible();
  await expect(page.getByText("写下正确的内容。")).toBeVisible();
  await page.getByLabel("正确的是").fill("2020 年 7 月 21 日出生");
  await page.getByLabel("来源名称").fill("基地公告");
  await page.getByLabel("来源链接或出处").fill("https://example.test/notice");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.getByRole("heading", { name: "已收到" })).toBeVisible();

  await page.goto("/me");
  await expect(page.getByRole("button", { name: `${panda.name}，等待审核` })).toBeVisible();
});
