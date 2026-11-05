import { stat } from "node:fs/promises";

import type { Browser } from "@e2e-dev/web";
import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { test } from "./support/test.ts";

/**
 * Takes the page offline the way a lost connection does: every API request fails and the browser reports
 * offline. e2e has no offline switch, so the route and the online flag stand in for it.
 */
async function goOffline(browser: Browser): Promise<void> {
  await browser.route("**/api/v2/**", (route) => route.abort());
  await browser.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
    return null;
  });
}

async function goOnline(browser: Browser): Promise<void> {
  await browser.unroute("**/api/v2/**");
  await browser.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    window.dispatchEvent(new Event("online"));
    return null;
  });
}

test("offline, the app says so, keeps the list it loaded, and recovers once back online", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  const row = screen.getByRole("button", new RegExp(`^${panda.name}`));
  await app.open("/find");
  await screen.getByLabel("搜索熊猫").fill(panda.name);
  await expect(row).toBeVisible();

  await goOffline(browser);
  await expect(screen.getByText("没有网络，显示的是已经加载的内容")).toBeVisible();
  await expect(row).toBeVisible();
  await row.tap();
  await expect(screen.getByText("资料暂时打不开。")).toBeVisible();

  await goOnline(browser);
  await expect(screen.getByText("没有网络，显示的是已经加载的内容")).toHaveCount(0);
  await screen.getByRole("button", "重试").tap();
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
});

test("started again without a connection, the app shows the list and profile it loaded last time", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  await app.open("/find");
  await screen.getByLabel("搜索熊猫").fill(panda.name);
  await screen.getByRole("button", new RegExp(`^${panda.name}`)).tap();
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();

  // A fresh start of the app on the same device, with every API request failing.
  await browser.route("**/api/v2/**", (route) => route.abort());
  await app.restart();
  await app.open("/find");
  await screen.getByLabel("搜索熊猫").fill(panda.name);
  await screen.getByRole("button", new RegExp(`^${panda.name}`)).tap();
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
  await expect(screen.getByLabel("生日，7.20，已确认")).toBeVisible();
});

test("a profile shares as an image card", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", "分享").tap();

  const card = screen.getByLabel(`${panda.name}的分享卡片`);
  await expect(card).toBeVisible();
  await expect(card.getByText("2020 年 7 月 20 日")).toBeVisible();
  await expect(card.getByText(`www.zhipanda.com/zh/pandas/${panda.slug}`)).toBeVisible();

  const file = await browser.waitForDownload(() => screen.getByRole("button", "分享图片").tap());
  expect(file.suggestedFilename).toBe(`zhipanda-${panda.slug}.png`);
  // A real rendered card, not an empty canvas.
  expect((await stat(file.absolutePath)).size).toBeGreaterThan(10_000);
});
