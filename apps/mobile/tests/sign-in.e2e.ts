import { expect } from "e2e";

import { signIn, testEmail } from "./support/session.ts";
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

test("a wrong code is refused with a message", async ({ app, screen }) => {
  await app.open("/me");
  await screen.getByRole("button", "登录").tap();
  await screen.getByLabel("邮箱").fill(testEmail("wrong-code"));
  await screen.getByRole("button", "获取验证码").tap();
  await screen.getByLabel("验证码").fill("000000");
  await screen.getByRole("button", "登录").last().tap();
  await expect(screen.getByText("验证码不对或已过期，请检查或重新获取。")).toBeVisible();
});
