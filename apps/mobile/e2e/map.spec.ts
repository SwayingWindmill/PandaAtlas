import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";

const run = () => fixture().panda.name.replace("测试熊猫", "");

test("the map opens a zoo from its dot and from the list, and lists a place with no coordinates", async ({ page }) => {
  const { zoo } = fixture();
  const place = `测试地点${run()}`;
  await page.goto("/find");
  await page.getByRole("button", { name: "熊猫在哪里" }).click();
  await expect(page.getByRole("heading", { name: "熊猫在哪里" })).toBeVisible();
  await expect(page.getByRole("img", { name: "大熊猫所在地世界地图" })).toBeVisible();

  const zooLabel = new RegExp(`^${zoo.name}，`);
  const places = page.getByTestId("map-places");
  await expect(places.getByRole("button", { name: zooLabel })).toBeVisible();
  await expect(places.getByRole("button", { name: new RegExp(`^${place}，日本，现在没有熊猫$`) })).toBeVisible();
  await expect(page.getByTestId("panda-world-map").getByRole("button", { name: new RegExp(place) })).toHaveCount(0);

  await page.getByTestId("panda-world-map").getByRole("button", { name: zooLabel }).click();
  await expect(page.getByRole("heading", { name: zoo.name })).toBeVisible();
  await page.getByRole("button", { name: "返回" }).click();
  await expect(page.getByRole("heading", { name: "熊猫在哪里" })).toBeVisible();

  await places.getByRole("button", { name: zooLabel }).click();
  await expect(page.getByRole("heading", { name: zoo.name })).toBeVisible();
  await page.getByRole("button", { name: "返回" }).click();

  await places.getByRole("button", { name: new RegExp(`^${place}，`) }).click();
  await expect(page.getByRole("heading", { name: place })).toBeVisible();
  await expect(page.getByText("日本", { exact: true })).toBeVisible();
});
