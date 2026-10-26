import { expect, test } from "@playwright/test";

import { signIn, testEmail } from "./session";

// The answer is drawn at random from published pandas, so the fan guesses fixture pandas until the puzzle ends,
// solved or out of guesses; either way a finished puzzle is saved to the account.
test("a signed-in fan finishes the Daily Panda and it joins the 图鉴", async ({ page }) => {
  await signIn(page, testEmail("daily"));
  await page.goto("/daily");
  const field = page.getByLabel("猜一只熊猫");
  const finished = page.getByText(/第 \d+ 次猜中|这次没猜中/);

  for (let attempt = 0; attempt < 10 && !(await finished.isVisible()); attempt += 1) {
    const left = await page.getByText(/还剩 \d+ 次/).textContent();
    await field.fill("测试熊猫");
    await page
      .getByRole("button", { name: /^测试熊猫/ })
      .first()
      .click();
    await expect(finished.or(page.getByText(/还剩 \d+ 次/).filter({ hasNotText: left ?? "" }))).toBeVisible();
  }

  await expect(finished).toBeVisible();
  await expect(page.getByText("已收进图鉴")).toBeVisible();
  await page.goto("/book");
  await expect(page.getByRole("button", { name: /，\d+\/\d+ 每日一猫$/ })).toBeVisible();
});
