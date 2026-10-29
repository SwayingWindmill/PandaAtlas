import { expect, test } from "@playwright/test";

// Draft copy is bundled for development builds. The local release does not include the
// real pandas the sample challenge names, so the challenge explains that instead of guessing.

test("a fan reads the draft 科普 pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "去看看" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "认识大熊猫" })).toBeVisible();

  const cards = page.getByRole("heading", { name: "知识卡", level: 2 }).locator("..");
  await cards.getByRole("button", { name: "[草稿] 黑眼圈" }).click();
  await expect(page.getByText("[草稿] 占位正文。正式文字由撰稿人填写，并注明来源后才能发布。")).toBeVisible();
  await expect(page.getByText("[草稿] 来源待写")).toBeVisible();

  await page.goto("/learn");
  const topics = page.getByRole("heading", { name: "专题", level: 2 }).locator("..");
  await topics.getByRole("button", { name: "[草稿] 怎么认脸" }).click();
  await expect(page.getByRole("heading", { name: "[草稿] 形状和左右差别" })).toBeVisible();
  await expect(page.getByText("[草稿] [形状和左右差别]")).toBeVisible();

  await page.goto("/learn");
  const terms = page.getByRole("heading", { name: "名词解释", level: 2 }).locator("..");
  await terms.getByRole("button", { name: "[草稿] 亚成体" }).click();
  await expect(page.getByRole("heading", { name: "[草稿] 亚成体" })).toBeVisible();
  await expect(page.getByText("[草稿] 占位释义。")).toBeVisible();

  await page.goto("/learn");
  const faces = page.getByRole("heading", { name: "认脸指南", level: 2 }).locator("..");
  await faces.getByRole("button", { name: "[草稿] 宝力" }).click();
  await expect(page.getByText("[草稿] [形状和左右差别]")).toBeVisible();
  await expect(page.getByText("暂无照片")).toBeVisible();

  await page.goto("/learn");
  await page.getByRole("button", { name: "认脸挑战" }).click();
  await expect(page.getByText("这道题的熊猫还不在当前资料里。")).toBeVisible();
});
