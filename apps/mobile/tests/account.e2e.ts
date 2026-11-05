import type { Screen } from "e2e";
import { expect } from "e2e";
import { TOTP } from "otpauth";

import { runScheduledCycles, takeDownAndRestore } from "./support/backend.ts";
import { fixture } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

/** Sets up an authenticator the way a fan would, reading the secret the app shows, and verifies a code. */
async function setUpTwoStep(screen: Screen): Promise<void> {
  await screen.getByRole("button", "开始设置").tap();
  const secret = (await screen.getByLabel("两步验证密钥").textContent())?.trim() ?? "";
  await screen.getByLabel("认证器验证码").fill(new TOTP({ secret }).generate());
  await screen.getByRole("button", "验证").tap();
}

test("a followed panda's review hold and return reach the inbox, and messages read", async ({ app, screen }) => {
  const { notice } = fixture();
  await signIn(app, screen, testEmail("inbox"));
  await app.open(`/pandas/${notice.slug}`);
  await screen.getByRole("button", `关注${notice.name}`).tap();
  await expect(screen.getByRole("button", `已关注${notice.name}，点按取消`)).toBeVisible();

  await takeDownAndRestore(notice.id);

  await app.open("/me");
  // The fixture release's update reaches the new follower too, so there is at least one more message.
  await screen.getByRole("button", /^通知，\d+ 条未读$/).tap();
  await expect(screen.getByRole("button", `未读，${notice.name}的资料暂时下线核对`)).toBeVisible();

  await screen.getByRole("button", `未读，${notice.name}的资料恢复公开了`).tap();
  await expect(screen.getByRole("heading", notice.name)).toBeVisible();
  await screen.getByRole("button", "返回").tap();
  await expect(screen.getByRole("button", `${notice.name}的资料恢复公开了`)).toBeVisible();

  await screen.getByRole("button", "全部已读").tap();
  await expect(screen.getByRole("button", `${notice.name}的资料暂时下线核对`)).toBeVisible();
  await expect(screen.getByRole("button", "全部已读")).toHaveCount(0);

  // 我的 refreshes its count when it is shown again. 通知 has the stack's own back link, not the photo pages' button.
  await screen.getByRole("link", /^返回/).tap();
  await expect(screen.getByRole("button", "通知")).toBeVisible();
});

test("notification preferences save to the account", async ({ app, screen, browser }) => {
  await signIn(app, screen, testEmail("preferences"));
  await app.open("/notifications");
  const email = screen.getByRole("switch", "资料更新，邮件");
  await expect(email).not.toBeChecked();
  await email.tap();
  await expect(email).toBeChecked();

  await browser.reload();
  await expect(screen.getByRole("switch", "资料更新，邮件")).toBeChecked();
});

test("after two-step verification, a data export is requested, processed and downloaded", async ({ app, screen, browser }) => {
  await signIn(app, screen, testEmail("export"));
  await app.open("/account");
  await setUpTwoStep(screen);
  await screen.getByRole("button", "申请导出").tap();
  await expect(screen.getByText("已提交，等待处理")).toBeVisible();

  await runScheduledCycles();
  await browser.reload();
  await expect(screen.getByText("已准备好", { exact: false })).toBeVisible();
  const file = await browser.waitForDownload(() => screen.getByRole("button", "下载导出文件").tap());
  expect(file.suggestedFilename).toMatch(/^zhipanda-export-\d{4}-\d{2}-\d{2}\.json$/);
});

test("account deletion asks for confirmation before it is requested", async ({ app, screen }) => {
  await signIn(app, screen, testEmail("delete"));
  await app.open("/account");
  await setUpTwoStep(screen);
  await screen.getByRole("button", "申请注销账号").tap();
  await expect(screen.getByText("确定要注销吗？")).toBeVisible();
  await screen.getByRole("button", "取消").tap();
  await expect(screen.getByText("确定要注销吗？")).toHaveCount(0);

  await screen.getByRole("button", "申请注销账号").tap();
  await screen.getByLabel("注销原因").fill("测试账号，用完了");
  await screen.getByRole("button", "确认注销").tap();
  await expect(screen.getByText("已提交，等待处理")).toBeVisible();
  await expect(screen.getByRole("button", "申请注销账号")).toHaveCount(0);
});
