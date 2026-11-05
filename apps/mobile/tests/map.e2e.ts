import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { test } from "./support/test.ts";

test("the map opens a zoo from its dot and from the list, and lists a place with no coordinates", async ({ app, screen }) => {
  const { zoo } = fixture();
  const place = `测试地点${runSuffix()}`;
  await app.open("/find");
  await screen.getByRole("button", "熊猫在哪里").tap();
  await expect(screen.getByRole("heading", "熊猫在哪里")).toBeVisible();
  await expect(screen.getByRole("image", "大熊猫所在地世界地图")).toBeVisible();

  const zooLabel = new RegExp(`^${zoo.name}，`);
  const places = screen.getByTestId("map-places");
  const map = screen.getByTestId("panda-world-map");
  await expect(places.getByRole("button", zooLabel)).toBeVisible();
  await expect(places.getByRole("button", new RegExp(`^${place}，日本，现在没有熊猫$`))).toBeVisible();
  await expect(map.getByRole("button", new RegExp(place))).toHaveCount(0);

  // Every run's zoo sits at the same coordinates, so on a reused local database the dot holds earlier runs'
  // zoos too and opens 这个点上 instead; this run's zoo is then picked there.
  const dot = map.getByRole("button", new RegExp(`(^|、)${zoo.name}[，、]`));
  const several = /个地方$/.test((await dot.getAttribute("aria-label")) ?? "");
  await dot.tap();
  if (several) await screen.getByRole("button", zooLabel).first().tap();
  await expect(screen.getByRole("heading", zoo.name)).toBeVisible();
  await screen.getByRole("button", "返回").tap();
  await expect(screen.getByRole("heading", "熊猫在哪里")).toBeVisible();

  await places.getByRole("button", zooLabel).tap();
  await expect(screen.getByRole("heading", zoo.name)).toBeVisible();
  await screen.getByRole("button", "返回").tap();

  await places.getByRole("button", new RegExp(`^${place}，`)).tap();
  await expect(screen.getByRole("heading", place)).toBeVisible();
  await expect(screen.getByText("日本")).toBeVisible();
});
