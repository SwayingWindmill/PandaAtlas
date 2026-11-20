import { Buffer } from "node:buffer";
import type { Browser } from "@e2e-dev/web";
import type { Screen } from "e2e";
import { expect } from "e2e";

import {
  expireRecentAuth as expireRecentAuthOnServer,
  runScheduledCycles,
  takeDownAndRestore,
} from "./support/backend.ts";
import { fixture } from "./support/fixture.ts";
import { mailCount, nextCode, signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

function latestInteractiveAmrSeconds(accessToken: string): number | undefined {
  const parts = accessToken.split(".");
  if (parts.length !== 3 || !parts[1]) return undefined;
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
    amr?: Array<{ timestamp?: unknown }>;
  };
  const timestamps = (payload.amr ?? [])
    .map((entry) => entry.timestamp)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return timestamps.length > 0 ? Math.max(...timestamps) : undefined;
}

/** Expires the current session's recent interactive auth watermark on the test API so privacy routes require fresh OTP verification. */
async function expireRecentAuth(browser: Browser): Promise<void> {
  const session = (await browser.evaluate(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { access_token?: unknown; user?: { id?: unknown } };
      if (typeof parsed.user?.id === "string" && typeof parsed.access_token === "string") {
        return { accountId: parsed.user.id, accessToken: parsed.access_token };
      }
    }
    return null;
  })) as { accountId: string; accessToken: string } | null;
  if (!session) throw new Error("Missing Supabase auth session in localStorage.");
  await expireRecentAuthOnServer(session.accountId, latestInteractiveAmrSeconds(session.accessToken));
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
  await expireRecentAuth(browser);

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
  await expireRecentAuth(browser);

  await screen.getByRole("button", "确认注销").tap();
  await reverifyByEmail(screen, email, 1);

  await expect(screen.getByText("已提交，等待处理")).toBeVisible();
  await expect(screen.getByRole("button", "申请注销账号")).toHaveCount(0);
});
