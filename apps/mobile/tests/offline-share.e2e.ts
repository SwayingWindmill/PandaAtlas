import { stat } from "node:fs/promises";

import type { Browser } from "@e2e-dev/web";
import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
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
  await expect(screen.getByLabel(/^生日，7月20日，2020 年 .*已确认$/)).toBeVisible();
});

test("a profile shares as an image card", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", "分享").tap();

  const card = screen.getByLabel(`${panda.name}的分享卡片`);
  await expect(card).toBeVisible();
  await expect(card.getByText("2020 年 7 月 20 日")).toBeVisible();
  await expect(card.getByText(`扫码看${panda.name}的家谱、照片和近况`)).toBeVisible();

  await screen.getByRole("button", "复制链接").tap();
  await expect(screen.getByRole("status").getByText("链接已复制")).toBeVisible();
  expect(await browser.evaluate(() => navigator.clipboard.readText())).toBe(`${panda.name} https://www.zhipanda.com/zh/pandas/${panda.slug}`);

  const file = await browser.waitForDownload(() => screen.getByRole("button", "分享图片").tap());
  expect(file.suggestedFilename).toBe(`zhipanda-${panda.slug}.png`);
  // A real rendered card, not an empty canvas.
  expect((await stat(file.absolutePath)).size).toBeGreaterThan(10_000);
});

test("downloads a venue offline pack, survives offline restart, and flushes queued check-ins once back online", async ({ app, screen, browser }) => {
  const { panda, zoo } = fixture();
  const note = "弱网暂存后的线下打卡";
  await signIn(app, screen, testEmail("offline-pack-queue"));

  await app.open(`/institutions/${zoo.slug}`);
  await expect(screen.getByRole("heading", zoo.name)).toBeVisible();
  await screen.getByRole("button", `${zoo.name}离线包`).tap();
  await screen.getByRole("button", "下载全园离线包").tap();
  await expect(screen.getByText(`${zoo.name}已可离线浏览`)).toBeVisible();

  // Restart offline: both the venue page and its residents remain readable from the pinned offline pack.
  await browser.route("**/api/v2/**", (route) => route.abort());
  await app.restart();
  await app.open(`/institutions/${zoo.slug}`);
  await expect(screen.getByRole("heading", zoo.name)).toBeVisible();
  await expect(screen.getByRole("button", `${zoo.name}离线包，已离线`)).toBeVisible();

  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();

  // Record a check-in while offline: queues locally and renders the souvenir ticket + diary card.
  await app.open(`/institutions/${zoo.slug}/checkin`);
  await expect(screen.getByRole("heading", "点选见过的熊猫")).toBeVisible();
  await screen.getByLabel("看猫小记").fill(note);
  await screen.getByRole("checkbox", new RegExp(`^${panda.name}`)).tap();
  await browser.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
    return null;
  });
  await screen.getByRole("button", /^保存本次打卡/).tap();

  await expect(screen.getByText(/逛园纪念票根/)).toBeVisible();
  await expect(screen.getByText("已暂存本机，联网后自动同步")).toBeVisible();
  await screen.getByRole("button", "查看看猫日记").tap();
  await expect(screen.getByText("1 条打卡暂存本机")).toBeVisible();
  await expect(screen.getByText(`“${note}”`)).toBeVisible();
  await expect(screen.getByRole("link", `查看${panda.name}`)).toBeVisible();

  // Reconnect: the offline queue flushes to the server and survives reload.
  await goOnline(browser);
  await expect(screen.getByText("1 条打卡暂存本机")).toHaveCount(0);
  await app.open("/visits");
  await expect(screen.getByText(`“${note}”`)).toBeVisible();
  await expect(screen.getByRole("link", `查看${panda.name}`)).toBeVisible();
});
