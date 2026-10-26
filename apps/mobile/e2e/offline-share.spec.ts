import { stat } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";

test("offline, the app says so, keeps the list it loaded, and recovers once back online", async ({ page, context }) => {
  const { panda } = fixture();
  const row = page.getByRole("button", { name: new RegExp(`^${panda.name}`) });
  await page.goto("/find");
  await page.getByLabel("搜索熊猫").fill(panda.name);
  await expect(row).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText("没有网络，显示的是已经加载的内容")).toBeVisible();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByText("资料暂时打不开。")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("没有网络，显示的是已经加载的内容")).toHaveCount(0);
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByRole("heading", { name: panda.name })).toBeVisible();
});

test("started again without a connection, the app shows the list and profile it loaded last time", async ({
  page,
  context,
}) => {
  const { panda } = fixture();
  await page.goto("/find");
  await page.getByLabel("搜索熊猫").fill(panda.name);
  await page.getByRole("button", { name: new RegExp(`^${panda.name}`) }).click();
  await expect(page.getByRole("heading", { name: panda.name })).toBeVisible();
  await page.close();

  // A fresh start of the app on the same device, with every API request failing.
  const restarted = await context.newPage();
  await restarted.route("**/api/v2/**", (route) => route.abort("internetdisconnected"));
  await restarted.goto("/find");
  await restarted.getByLabel("搜索熊猫").fill(panda.name);
  await restarted.getByRole("button", { name: new RegExp(`^${panda.name}`) }).click();
  await expect(restarted.getByRole("heading", { name: panda.name })).toBeVisible();
  await expect(restarted.getByText("2020 年 7 月 20 日")).toBeVisible();
});

test("a profile shares as an image card", async ({ page }) => {
  const { panda } = fixture();
  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: "分享", exact: true }).click();

  const card = page.getByLabel(`${panda.name}的分享卡片`);
  await expect(card).toBeVisible();
  await expect(card.getByText("2020 年 7 月 20 日")).toBeVisible();
  await expect(card.getByText(`www.zhipanda.com/zh/pandas/${panda.slug}`)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "分享图片" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`zhipanda-${panda.slug}.png`);
  // A real rendered card, not an empty canvas.
  expect((await stat(await file.path())).size).toBeGreaterThan(10_000);
});
