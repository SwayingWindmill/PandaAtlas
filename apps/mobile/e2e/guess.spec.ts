import { expect, test } from "@playwright/test";

test("a fan answers a 猜熊猫 question and sees which panda it was", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "来一题" }).click();
  await expect(page.getByText("猜熊猫　第 1 题")).toBeVisible();
  await expect(page.getByRole("button", { name: "返回" })).toBeVisible();

  // Questions are drawn at random from every published one, so any option may be the answer.
  const options = page.getByRole("group", { name: "选项" }).getByRole("button");
  await expect(options).toHaveCount(4);
  await options.first().click();
  await expect(page.getByRole("heading", { name: /猜对了|这次没猜对/ })).toBeVisible();
  await expect(page.getByText("是它")).toBeVisible();

  await page.getByRole("button", { name: "下一题" }).click();
  await expect(page.getByText("猜熊猫　第 2 题")).toBeVisible();
});
