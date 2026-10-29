import { expect, test } from "@playwright/test";

// The working copy is unmarked draft text. The local release does not include the real pandas
// the challenge names, so the challenge explains that instead of playing the round.

test("a fan reads the draft 科普 pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "去看看" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "认识大熊猫" })).toBeVisible();

  await page.getByRole("button", { name: "黑眼圈" }).first().click();
  await expect(page.getByText("大熊猫眼周的黑斑叫眼斑")).toBeVisible();
  await expect(page.getByRole("link", { name: "加州大学戴维斯分校：大熊猫为什么是黑白的" })).toBeVisible();

  await page.goto("/learn");
  await page.getByRole("button", { name: "怎么认脸" }).click();
  await expect(page.getByRole("heading", { name: "脸型和左右差别" })).toBeVisible();
  await expect(page.getByText("脸型因个体而异")).toBeVisible();

  await page.goto("/learn");
  await page.getByRole("button", { name: "亚成体" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "亚成体" })).toBeVisible();
  await expect(page.getByText("一岁半到性成熟前的大熊猫")).toBeVisible();

  await page.goto("/learn");
  await page.getByRole("button", { name: "宝力" }).click();
  await expect(page.getByText("两颊不如青宝蓬松。")).toBeVisible();
  await expect(page.getByText("脸型")).toBeVisible();
  await expect(page.getByText("左右差别")).toHaveCount(0);
  await expect(page.getByText("暂无照片")).toBeVisible();

  await page.goto("/learn");
  await page.getByRole("button", { name: "认脸挑战" }).click();
  await expect(page.getByText("这道题的熊猫还不在当前资料里。")).toBeVisible();
});
