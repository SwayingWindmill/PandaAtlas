import { expect, test } from "@playwright/test";

import { signIn, testEmail } from "./session";

test("a fan signs in with an emailed code, names the account, stays signed in, and signs out", async ({ page }) => {
  const email = testEmail("sign-in");
  await signIn(page, email);

  await page.getByRole("button", { name: "改名字" }).click();
  await page.getByLabel("名字").fill("竹子爱好者");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("竹子爱好者").last()).toBeVisible();

  // The session survives a reload, and the name comes back from the API.
  await page.reload();
  await expect(page.getByText("竹子爱好者").last()).toBeVisible();

  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
});

test("a wrong code is refused with a message", async ({ page }) => {
  const email = testEmail("wrong-code");
  await page.goto("/me");
  await page.getByRole("button", { name: "登录" }).click();
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill("000000");
  await page.getByRole("button", { name: "登录" }).last().click();
  await expect(page.getByText("验证码不对或已过期，请检查或重新获取。")).toBeVisible();
});
