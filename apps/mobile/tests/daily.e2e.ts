import { expect } from "e2e";

import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

// The answer is drawn at random from published pandas, so the fan guesses fixture pandas until the puzzle ends,
// solved or out of guesses; either way a finished puzzle is saved to the account.
test("a signed-in fan finishes the Daily Panda and it joins the 图鉴", async ({ app, screen }) => {
  await signIn(app, screen, testEmail("daily"));
  await app.open("/daily");
  const field = screen.getByLabel("猜一只熊猫");
  const finished = screen.getByText(/第 \d+ 次猜中|这次没猜中/);
  const remaining = screen.getByText(/还剩 \d+ 次/);

  for (let attempt = 0; attempt < 10 && !(await finished.isVisible()); attempt += 1) {
    const left = (await remaining.textContent()) ?? "";
    await field.fill("测试熊猫");
    await screen.getByRole("button", /^测试熊猫/).first().tap();
    // Each guess either ends the puzzle or counts one down.
    await expect(finished.or(remaining.filter({ hasNotText: left })).first()).toBeVisible();
  }

  await expect(finished).toBeVisible();
  await expect(screen.getByText("已收进图鉴")).toBeVisible();
  await app.open("/book");
  await expect(screen.getByRole("link", /^No\.1，.+每日一猫/)).toBeVisible();
});
