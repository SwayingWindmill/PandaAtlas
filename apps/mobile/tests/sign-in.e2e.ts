import { expect } from "e2e";

import { latestCode, mailCount, nextCode, signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

test("a fan signs in with an emailed code, names the account, stays signed in, and signs out", async ({ app, screen, browser }) => {
  await signIn(app, screen, testEmail("sign-in"));

  await screen.getByRole("button", "改名字").tap();
  await screen.getByLabel("名字").fill("竹子爱好者");
  await screen.getByRole("button", "保存").tap();
  await expect(screen.getByText("竹子爱好者").last()).toBeVisible();

  // The session survives a reload, and the name comes back from the API.
  await browser.reload();
  await expect(screen.getByText("竹子爱好者").last()).toBeVisible();

  // 退出登录 lives in 设置, behind the gear on 我的.
  await screen.getByRole("button", "设置").tap();
  await screen.getByRole("button", "退出登录").tap();
  // Signed out, 设置 offers 登录 in place of the account.
  await expect(screen.getByRole("link", "登录")).toBeVisible();
});

test("a wrong code is refused as wrong, and the field is cleared for another try", async ({ app, screen }) => {
  await app.open("/me");
  await screen.getByRole("button", "绑定同步").tap();
  await screen.getByLabel("邮箱").fill(testEmail("wrong-code"));
  await screen.getByRole("button", "获取验证码").tap();
  await screen.getByLabel("验证码").fill("000000");
  await expect(screen.getByText("验证码不对，请检查后再输入。")).toBeVisible();
  await expect(screen.getByLabel("验证码")).toHaveValue("");
});

test("a fan waits out the minute, asks for a new code, and signs in with it", async ({ app, screen }) => {
  const email = testEmail("resend");
  await app.open("/me");
  await screen.getByRole("button", "绑定同步").tap();
  await screen.getByLabel("邮箱").fill(email);
  await screen.getByRole("button", "获取验证码").tap();
  const first = await latestCode(email);
  await expect(screen.getByRole("button", /^\d+ 秒后可重新发送$/)).toBeDisabled();

  const resend = screen.getByRole("button", "重新发送验证码");
  await expect(resend).toBeEnabled({ timeout: 70_000 });
  const sent = await mailCount(email);
  await resend.tap();
  const second = await nextCode(email, sent);
  expect(second).not.toBe(first);
  await expect(screen.getByRole("button", /^\d+ 秒后可重新发送$/)).toBeDisabled();

  await screen.getByLabel("验证码").fill(second);
  await expect(screen.getByRole("button", "改名字")).toBeVisible();
});
