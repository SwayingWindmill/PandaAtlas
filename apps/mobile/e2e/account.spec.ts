import { type Page, expect, test } from "@playwright/test";
import { TOTP } from "otpauth";

import { runScheduledCycles, takeDownAndRestore } from "./backend";
import { fixture } from "./fixture";
import { signIn, testEmail } from "./session";

/** Sets up an authenticator the way a fan would, reading the secret the app shows, and verifies a code. */
async function setUpTwoStep(page: Page): Promise<void> {
  await page.getByRole("button", { name: "开始设置" }).click();
  const secret = (await page.getByLabel("两步验证密钥").textContent())?.trim() ?? "";
  await page.getByLabel("认证器验证码").fill(new TOTP({ secret }).generate());
  await page.getByRole("button", { name: "验证", exact: true }).click();
}

test("a followed panda's review hold and return reach the inbox, and messages read", async ({ page }) => {
  const { notice } = fixture();
  await signIn(page, testEmail("inbox"));
  await page.goto(`/pandas/${notice.slug}`);
  await page.getByRole("button", { name: `关注${notice.name}` }).click();
  await expect(page.getByRole("button", { name: `已关注${notice.name}，点按取消` })).toBeVisible();

  await takeDownAndRestore(notice.id);

  await page.goto("/me");
  // The fixture release's update reaches the new follower too, so there is at least one more message.
  await page.getByRole("button", { name: /^通知，\d+ 条未读$/ }).click();
  await expect(page.getByRole("button", { name: `未读，${notice.name}的资料暂时下线核对` })).toBeVisible();

  await page.getByRole("button", { name: `未读，${notice.name}的资料恢复公开了` }).click();
  await expect(page.getByRole("heading", { name: notice.name })).toBeVisible();
  await page.getByRole("button", { name: "返回" }).click();
  await expect(page.getByRole("button", { name: `${notice.name}的资料恢复公开了` })).toBeVisible();

  await page.getByRole("button", { name: "全部已读" }).click();
  await expect(page.getByRole("button", { name: `${notice.name}的资料暂时下线核对` })).toBeVisible();
  await expect(page.getByRole("button", { name: "全部已读" })).toHaveCount(0);

  // 我的 refreshes its count when it is shown again.
  await page.getByRole("button", { name: "返回" }).click();
  await expect(page.getByRole("button", { name: "通知", exact: true })).toBeVisible();
});

test("notification preferences save to the account", async ({ page }) => {
  await signIn(page, testEmail("preferences"));
  await page.goto("/notifications");
  const email = page.getByRole("switch", { name: "资料更新，邮件" });
  await expect(email).not.toBeChecked();
  await email.click();
  await expect(email).toBeChecked();

  await page.reload();
  await expect(page.getByRole("switch", { name: "资料更新，邮件" })).toBeChecked();
});

test("after two-step verification, a data export is requested, processed and downloaded", async ({ page }) => {
  await signIn(page, testEmail("export"));
  await page.goto("/account");
  await setUpTwoStep(page);
  await page.getByRole("button", { name: "申请导出" }).click();
  await expect(page.getByText("已提交，等待处理")).toBeVisible();

  await runScheduledCycles();
  await page.reload();
  await expect(page.getByText("已准备好")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载导出文件" }).click();
  expect((await download).suggestedFilename()).toMatch(/^zhipanda-export-\d{4}-\d{2}-\d{2}\.json$/);
});

test("account deletion asks for confirmation before it is requested", async ({ page }) => {
  await signIn(page, testEmail("delete"));
  await page.goto("/account");
  await setUpTwoStep(page);
  await page.getByRole("button", { name: "申请注销账号" }).click();
  await expect(page.getByText("确定要注销吗？")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByText("确定要注销吗？")).toHaveCount(0);

  await page.getByRole("button", { name: "申请注销账号" }).click();
  await page.getByLabel("注销原因").fill("测试账号，用完了");
  await page.getByRole("button", { name: "确认注销" }).click();
  await expect(page.getByText("已提交，等待处理")).toBeVisible();
  await expect(page.getByRole("button", { name: "申请注销账号" })).toHaveCount(0);
});
