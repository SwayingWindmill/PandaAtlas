import type { Screen } from "e2e";
import { expect } from "e2e";

import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

// Questions are drawn at random from every published one, so any option may be the answer.
async function answerFirstOption(screen: Screen): Promise<void> {
  const options = screen.getByRole("group", "选项").getByRole("button");
  await expect(options).toHaveCount(4);
  await options.first().tap();
  await expect(screen.getByRole("heading", /猜对了|这次没猜对/)).toBeVisible();
  // The answer's option is marked 是它 once the question is answered.
  await expect(screen.getByRole("group", "选项").getByRole("button", /，是它$/)).toBeVisible();
}

test("a fan answers a 猜熊猫 question and sees which panda it was", async ({ app, screen }) => {
  await app.open("/");
  await screen.getByRole("link", "看照片认熊猫，猜熊猫").tap();
  await expect(screen.getByText("猜熊猫　第 1 题")).toBeVisible();
  await expect(screen.getByRole("link", /^返回/)).toBeVisible();

  await answerFirstOption(screen);
  await expect(screen.getByRole("button", /^看.+的资料$/)).toBeVisible();
  await screen.getByRole("button", "下一题").tap();
  await expect(screen.getByText("猜熊猫　第 2 题")).toBeVisible();
});

test("signed in, the answered panda joins the 图鉴", async ({ app, screen }) => {
  await signIn(app, screen, testEmail("guess"));
  await app.open("/guess");
  await answerFirstOption(screen);

  await app.open("/book");
  await expect(screen.getByRole("progressbar", /^点亮 \d+%$/)).toBeVisible();
  await expect(screen.getByRole("link", /^No\.1，.+猜熊猫认出$/)).toBeVisible();
});
