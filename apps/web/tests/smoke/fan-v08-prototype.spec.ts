import { expect, test } from "@playwright/test";

test("fan V8 prototype renders the immersive home journey", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08");

  await expect(page.getByTestId("fan-v08-prototype")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "从一只熊猫，走进整个世界。" })).toBeVisible();
  await expect(page.getByText("V8.1 视觉原型 · 图片为评审 fixture")).toBeVisible();
  await expect(page.getByRole("heading", { name: "美香不是一个孤立的名字。" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /只公开熊猫，等你继续认识/ })).toBeVisible();
});
