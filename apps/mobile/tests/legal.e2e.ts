import type { Browser } from "@e2e-dev/web";
import type { Screen } from "e2e";
import { expect } from "e2e";

import { openedTabs, recordOpenedTabs } from "./support/opened-tabs.ts";
import { test } from "./support/test.ts";

async function expectOpens(screen: Screen, browser: Browser, link: string, url: string): Promise<void> {
  await screen.getByRole("link", link).tap();
  await expect.poll(() => openedTabs(browser)).toContain(url);
}

test("设置 opens the user agreement and the privacy policy", async ({ app, screen, browser }) => {
  await recordOpenedTabs(browser);
  await app.open("/settings");
  await expectOpens(screen, browser, "用户协议", "https://www.zhipanda.com/zh/terms");
  await expectOpens(screen, browser, "隐私政策", "https://www.zhipanda.com/zh/privacy");
});

test("sign-in says logging in agrees to the user agreement and the privacy policy", async ({ app, screen, browser }) => {
  await recordOpenedTabs(browser);
  await app.open("/sign-in");
  await expect(screen.getByText("登录即表示同意《用户协议》和《隐私政策》")).toBeVisible();
  await expectOpens(screen, browser, "《用户协议》", "https://www.zhipanda.com/zh/terms");
  await expectOpens(screen, browser, "《隐私政策》", "https://www.zhipanda.com/zh/privacy");
});
