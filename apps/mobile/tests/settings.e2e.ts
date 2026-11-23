import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { openedTabs, recordOpenedTabs } from "./support/opened-tabs.ts";
import { test } from "./support/test.ts";

test("设置 shows the app version", async ({ app, screen }) => {
  await app.open("/settings");
  await expect(screen.getByText("版本")).toBeVisible();
  await expect(screen.getByText(/^\d+\.\d+\.\d+/)).toBeVisible();
});

test("清除本地缓存 drops the pages saved for offline use", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();

  await app.open("/settings");
  await screen.getByRole("button", "清除本地缓存").tap();
  await expect(screen.getByRole("button", "清除本地缓存，已清除")).toBeVisible();

  // Started again without a connection, the profile it had saved is gone.
  await browser.route("**/api/v2/**", (route) => route.abort());
  await app.restart();
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByText("资料暂时打不开。")).toBeVisible();
});

test("联系我们 writes to hello@zhipanda.com with the version and system", async ({ app, screen, browser }) => {
  await recordOpenedTabs(browser);
  await app.open("/settings");
  await screen.getByRole("link", "联系我们").tap();
  await expect.poll(() => openedTabs(browser)).toHaveLength(1);
  const [mail] = await openedTabs(browser);
  const url = new URL(mail!);
  expect(url.protocol).toBe("mailto:");
  expect(url.pathname).toBe("hello@zhipanda.com");
  expect(url.searchParams.get("body")).toMatch(/App 版本：\d+\.\d+\.\d+/);
  expect(url.searchParams.get("body")).toContain("系统：web");
});
