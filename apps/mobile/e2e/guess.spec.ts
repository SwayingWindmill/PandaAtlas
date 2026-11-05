import { type Page, expect, test } from "@playwright/test";

import { signIn, testEmail } from "./session";

// Questions are drawn at random from every published one, so any option may be the answer.
async function answerFirstOption(page: Page): Promise<void> {
  const options = page.getByRole("group", { name: "选项" }).getByRole("button");
  await expect(options).toHaveCount(4);
  await options.first().click();
  await expect(page.getByRole("heading", { name: /猜对了|这次没猜对/ })).toBeVisible();
  // The answer's option is marked 是它 once the question is answered.
  await expect(page.getByRole("group", { name: "选项" }).getByRole("button", { name: /，是它$/ })).toBeVisible();
}

test("a fan answers a 猜熊猫 question and sees which panda it was", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "猜熊猫", exact: true }).click();
  await expect(page.getByText("猜熊猫　第 1 题")).toBeVisible();
  await expect(page.getByRole("link", { name: /^返回/ })).toBeVisible();

  await answerFirstOption(page);
  await expect(page.getByRole("button", { name: /^看.+的资料$/ })).toBeVisible();
  await page.getByRole("button", { name: "下一题" }).click();
  await expect(page.getByText("猜熊猫　第 2 题")).toBeVisible();
});

test("signed in, the answered panda joins the 图鉴", async ({ page }) => {
  await signIn(page, testEmail("guess"));
  await page.goto("/guess");
  await answerFirstOption(page);

  await page.goto("/book");
  await expect(page.getByRole("progressbar", { name: /^点亮 \d+%$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^No\.1，.+猜熊猫认出$/ })).toBeVisible();
});
