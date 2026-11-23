import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { test } from "./support/test.ts";

// The fixture publishes no 场馆动态, no 海外状态 and no 比一比, the state a fresh production release can be in.
// No entry may then lead to a page with nothing on it.

test("with nothing published, 今天 offers no 归国 shortcut", async ({ app, screen, browser }) => {
  const overseas = browser.waitForResponse(/\/api\/v2\/overseas-status/);
  await app.open("/");
  await overseas;
  await expect(screen.getByRole("link", "挑战")).toBeVisible();
  await expect(screen.getByRole("link", "归国")).toHaveCount(0);
});

test("with nothing published, 基地和动物园 lists no 场馆动态 or 归国熊猫", async ({ app, screen, browser }) => {
  const news = browser.waitForResponse(/\/api\/v2\/venue-news/);
  const overseas = browser.waitForResponse(/\/api\/v2\/overseas-status/);
  await app.open("/institutions");
  await Promise.all([news, overseas]);
  await expect(screen.getByText(fixture().zoo.name, { exact: false })).toBeVisible();
  await expect(screen.getByRole("link", "场馆动态")).toHaveCount(0);
  await expect(screen.getByRole("link", "归国熊猫")).toHaveCount(0);
});

test("with nothing published, 发现 shows no 归国熊猫, 场馆动态 or 比一比", async ({ app, screen, browser }) => {
  const loaded = Promise.all([
    browser.waitForResponse(/\/api\/v2\/venue-news/),
    browser.waitForResponse(/\/api\/v2\/overseas-status/),
    browser.waitForResponse(/\/api\/v2\/comparisons/),
  ]);
  await app.open("/discover");
  await loaded;
  await expect(screen.getByText("玩一玩")).toBeVisible();
  await expect(screen.getByText("归国熊猫", { exact: false })).toHaveCount(0);
  await expect(screen.getByText("场馆动态", { exact: false })).toHaveCount(0);
  await expect(screen.getByText("比一比", { exact: false })).toHaveCount(0);
});

test("once a return is published, 今天 offers 归国 and it opens 归国熊猫", async ({ app, screen, browser }) => {
  const { panda, zoo } = fixture();
  await browser.route(/\/api\/v2\/overseas-status/, (route) =>
    route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      json: {
        items: [
          {
            pandaSlug: panda.slug,
            stage: "returned",
            institutionSlug: zoo.slug,
            returnedOn: "2026-10-01",
            sourceUrl: "https://example.org/return",
            sourcePublisher: "测试来源",
            updatedAt: "2026-10-02T00:00:00Z",
          },
        ],
      },
    }),
  );
  await app.open("/");
  await screen.getByRole("link", "归国").tap();
  await expect(screen.getByRole("heading", "归国熊猫")).toBeVisible();
});
