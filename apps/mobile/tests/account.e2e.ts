import type { Browser } from "@e2e-dev/web";
import type { Screen } from "e2e";
import { expect } from "e2e";

import { ageInteractiveAuth, runScheduledCycles, takeDownAndRestore } from "./support/backend.ts";
import { fixture } from "./support/fixture.ts";
import { mailCount, nextCode, signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

/** Backdates interactive auth claims and expires the cached access token so Supabase refreshes a stale-auth JWT. */
async function expireRecentAuth(browser: Browser, email: string): Promise<void> {
  await ageInteractiveAuth(email);
  const updated = (await browser.evaluate(() => {
    const expiredAt = Math.floor(Date.now() / 1000) - 60;
    let count = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      parsed.expires_at = expiredAt;
      localStorage.setItem(key, JSON.stringify(parsed));
      count += 1;
    }
    return count;
  })) as number;
  if (updated === 0) throw new Error("Missing Supabase auth token in localStorage.");
}

/** Proves the verification card does not auto-mail on mount, then completes user-triggered email OTP re-verification. */
async function reverifyByEmail(screen: Screen, email: string, priorMailCount: number): Promise<void> {
  await expect(screen.getByRole("button", "发送验证码")).toBeVisible();
  // Clears GoTrue's 1s resend cooldown while proving mounting Verification sends nothing automatically.
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  expect(await mailCount(email)).toBe(priorMailCount);

  await screen.getByRole("button", "发送验证码").tap();
  await screen.getByLabel("邮箱验证码").fill(await nextCode(email, priorMailCount));
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

test("when recent auth has lapsed, email-code verification unlocks data export and downloads the file", async ({
  app,
  screen,
  browser,
}) => {
  const email = testEmail("export");
  await signIn(app, screen, email);
  await expireRecentAuth(browser, email);

  await app.open("/account");
  await reverifyByEmail(screen, email, 1);

  await screen.getByRole("button", "申请导出").tap();
  await expect(screen.getByText("已提交，等待处理")).toBeVisible();

  await runScheduledCycles();
  await browser.reload();
  await expect(screen.getByText("已准备好", { exact: false })).toBeVisible();
  const file = await browser.waitForDownload(() => screen.getByRole("button", "下载导出文件").tap());
  expect(file.suggestedFilename).toMatch(/^zhipanda-export-\d{4}-\d{2}-\d{2}\.json$/);
});

test("account deletion asks for confirmation, re-verifies when recent auth lapses, and retries the request", async ({
  app,
  screen,
  browser,
}) => {
  const email = testEmail("delete");
  await signIn(app, screen, email);
  await app.open("/account");
  await expect(screen.getByRole("button", "申请注销账号")).toBeVisible();

  await screen.getByRole("button", "申请注销账号").tap();
  await expect(screen.getByText("确定要注销吗？")).toBeVisible();
  await screen.getByRole("button", "取消").tap();
  await expect(screen.getByText("确定要注销吗？")).toHaveCount(0);

  await screen.getByRole("button", "申请注销账号").tap();
  await screen.getByLabel("注销原因").fill("测试账号，用完了");
  await expireRecentAuth(browser, email);

  await screen.getByRole("button", "确认注销").tap();
  await reverifyByEmail(screen, email, 1);

  await expect(screen.getByText("已提交，等待处理")).toBeVisible();
  await expect(screen.getByRole("button", "申请注销账号")).toHaveCount(0);
});
