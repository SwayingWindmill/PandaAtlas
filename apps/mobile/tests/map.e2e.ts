import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { test } from "./support/test.ts";

test("the map shows a zoo from its marker and from the list, and lists a place with no coordinates", async ({ app, screen }) => {
  const { zoo } = fixture();
  const place = `测试地点${runSuffix()}`;
  await app.open("/find");
  await screen.getByRole("link", /^熊猫地图/).tap();
  await expect(screen.getByRole("heading", "熊猫地图")).toBeVisible();
  await expect(screen.getByRole("image", "大熊猫所在地地图")).toBeVisible();

  const zooLabel = new RegExp(`^${zoo.name}，`);
  const places = screen.getByTestId("map-places");
  const map = screen.getByTestId("panda-world-map");
  await expect(places.getByRole("button", zooLabel)).toBeVisible();
  await expect(places.getByRole("button", new RegExp(`^${place}，日本，现在没有熊猫$`))).toBeVisible();
  await expect(map.getByRole("button", new RegExp(place))).toHaveCount(0);

  // Every run's zoo sits at the same coordinates, so on a reused local database the marker holds earlier
  // runs' zoos too; a tap then zooms in, and the zoo is picked from the list instead.
  const marker = map.getByRole("button", new RegExp(`(^|、)${zoo.name}[，、]`));
  const several = /个地方，点一下放大$/.test((await marker.getAttribute("aria-label")) ?? "");
  if (several) await places.getByRole("button", zooLabel).first().tap();
  else await marker.tap();
  await expect(screen.getByRole("heading", zoo.name)).toBeVisible();
  await screen.getByRole("button", `打开${zoo.name}的页面`).tap();
  await expect(screen.getByRole("heading", zoo.name)).toBeVisible();
  await screen.getByRole("button", "返回").tap();

  await screen.getByRole("button", "关闭").tap();
  await places.getByRole("button", new RegExp(`^${place}，`)).tap();
  await expect(screen.getByRole("heading", place)).toBeVisible();
  await expect(screen.getByText("日本")).toBeVisible();
});
