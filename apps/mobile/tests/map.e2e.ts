import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { test } from "./support/test.ts";

test("the map shows a zoo from its marker and from the list, and lists a place with no coordinates", async ({ app, screen }) => {
  const { zoo } = fixture();
  const place = `测试地点${runSuffix()}`;
  await app.open("/map");
  await expect(screen.getByRole("tab", /^全部 /)).toBeVisible();
  await expect(screen.getByRole("tab", "野生区")).toBeVisible();
  const map = screen.getByTestId("panda-world-map");
  await expect(map.getByRole("image", "大熊猫所在地地图")).toBeVisible();

  const zooLabel = new RegExp(`^${zoo.name}，`);
  const places = screen.getByTestId("map-places");
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
  await expect(screen.getByRole("heading", "住在这里")).toBeVisible();
  await expect(screen.getByRole("heading", "参观攻略")).toBeVisible();
  await screen.getByRole("button", "返回").tap();

  await screen.getByRole("button", "关闭").tap();
  await places.getByRole("button", new RegExp(`^${place}，`)).tap();
  await expect(screen.getByRole("heading", place)).toBeVisible();
  await expect(screen.getByText("日本")).toBeVisible();
});

test("filter pills open timeline and switch to the wild habitats view", async ({ app, screen }) => {
  await app.open("/map");
  const map = screen.getByTestId("panda-world-map");
  await expect(screen.getByRole("tab", { name: /^全部 /, selected: true })).toBeVisible();
  await expect(screen.getByRole("switch", "野生区图层")).toBeChecked();

  await screen.getByRole("button", /^分布时间轴/).tap();
  await expect(screen.getByRole("heading", "分布时间轴")).toBeVisible();
  await expect(screen.getByLabel("年份")).toBeVisible();
  await screen.getByRole("button", "关闭时间轴").tap();

  await screen.getByRole("tab", "野生区").tap();
  await expect(map.getByRole("button", /熊猫$|点一下放大$/)).toHaveCount(0);
  await expect(map.getByRole("button", /^邛崃山，/)).toBeVisible();

  await map.getByRole("button", /^邛崃山，野生大熊猫 519 只$/).tap();
  await expect(screen.getByRole("heading", "邛崃山")).toBeVisible();
  await expect(screen.getByLabel(/^邛崃山A，87 只/)).toBeVisible();
  await expect(screen.getByRole("link", "打开数据来源")).toBeVisible();
  await expect(screen.getByRole("button", "打开邛崃山的页面")).toBeVisible();
  await screen.getByRole("button", "关闭").tap();
});

test("a wild habitat has its own page, with its populations, the other ranges and the source", async ({ app, screen }) => {
  await app.open("/wild/qionglai");
  await expect(screen.getByRole("heading", "邛崃山")).toBeVisible();
  await expect(screen.getByRole("image", "邛崃山的4个局域种群在地图上的大致位置")).toBeVisible();
  await expect(screen.getByLabel("野生大熊猫 519 只")).toBeVisible();
  await expect(screen.getByLabel(/^邛崃山B，224 只/)).toBeVisible();
  await expect(screen.getByRole("link", "打开数据来源")).toBeVisible();

  await screen.getByRole("button", /^岷山/).tap();
  await expect(screen.getByRole("heading", "岷山")).toBeVisible();
  await expect(screen.getByLabel("野生大熊猫 765 只")).toBeVisible();
});

test("opening /map?filter=visited selects the visited tab and shows the passport card", async ({ app, screen }) => {
  await app.open("/map?filter=visited");
  await expect(screen.getByRole("tab", { name: /^我去过 0/, selected: true })).toBeVisible();
  await expect(screen.getByText(/^已去过 0 \//)).toBeVisible();
  await expect(screen.getByText("还没有去过的场馆足迹")).toBeVisible();
  await screen.getByRole("button", "看看全部场馆").tap();
  await expect(screen.getByRole("tab", { name: /^全部 /, selected: true })).toBeVisible();
});
