import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";

test("family portraits re-centre the tree, while 家谱 rows open a profile", async ({ page }) => {
  const { panda } = fixture();
  const run = panda.name.replace("测试熊猫", "");
  const mother = `选项丙${run}`;

  await page.goto(`/pandas/${panda.slug}/family`);
  await expect(page.getByRole("heading", { name: `${panda.name}的家族` })).toBeVisible();
  await page.getByRole("button", { name: `${mother}，妈妈，查看它的家族` }).click();
  await expect(page.getByRole("heading", { name: `${mother}的家族` })).toBeVisible();

  await page.getByRole("button", { name: "返回" }).click();
  await expect(page.getByRole("heading", { name: `${panda.name}的家族` })).toBeVisible();
  // The 家谱 list below the tree opens a profile; its row reads name then relation, without the tree's "查看它的家族".
  await page.getByRole("button", { name: new RegExp(`^${mother}(?!.*查看它的家族).*妈妈`) }).first().click();
  await expect(page.getByRole("heading", { name: mother })).toBeVisible();
});

test("returning to a previously viewed family uses the cached tree", async ({ page }) => {
  const { panda } = fixture();
  const run = panda.name.replace("测试熊猫", "");
  const mother = `选项丙${run}`;
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v2/pandas/") || url.pathname === "/api/v2/lineage") requests.push(url.pathname);
  });

  await page.goto(`/pandas/${panda.slug}/family`);
  await expect(page.getByRole("heading", { name: `${panda.name}的家族` })).toBeVisible();
  await page.getByRole("button", { name: `${mother}，妈妈，查看它的家族` }).click();
  await expect(page.getByRole("heading", { name: `${mother}的家族` })).toBeVisible();
  const motherApiPath = `/api/v2/pandas/${new URL(page.url()).pathname.split("/")[2]}`;
  await page.getByRole("button", { name: "返回" }).click();
  await expect(page.getByRole("heading", { name: `${panda.name}的家族` })).toBeVisible();
  const before = requests.length;
  await page.getByRole("button", { name: `${mother}，妈妈，查看它的家族` }).click();
  await expect(page.getByRole("heading", { name: `${mother}的家族` })).toBeVisible();
  expect(requests.slice(before).filter((path) => path === motherApiPath || path === "/api/v2/lineage")).toEqual([]);
});
