import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { test } from "./support/test.ts";

test("family portraits re-centre the tree, while 家谱 rows open a profile", async ({ app, screen }) => {
  const { panda } = fixture();
  const mother = `选项丙${runSuffix()}`;

  await app.open(`/pandas/${panda.slug}/family`);
  await expect(screen.getByRole("heading", `${panda.name}的家族`)).toBeVisible();
  await screen.getByRole("button", `${mother}，妈妈，查看它的家族`).tap();
  await expect(screen.getByRole("heading", `${mother}的家族`)).toBeVisible();

  await screen.getByRole("button", "返回").tap();
  await expect(screen.getByRole("heading", `${panda.name}的家族`)).toBeVisible();
  // The 家谱 list below the tree opens a profile; its row is named by the panda alone, unlike the tree's portrait.
  await screen.getByRole("button", mother).tap();
  await expect(screen.getByRole("heading", mother)).toBeVisible();
});

test("returning to a previously viewed family uses the cached tree", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  const mother = `选项丙${runSuffix()}`;
  // Every profile and lineage request passes through, and its path is noted.
  const requests: string[] = [];
  await browser.route(/\/api\/v2\/(pandas\/|lineage$)/, async (route) => {
    requests.push(new URL(route.request.url).pathname);
    await route.continue();
  });

  await app.open(`/pandas/${panda.slug}/family`);
  await expect(screen.getByRole("heading", `${panda.name}的家族`)).toBeVisible();
  await screen.getByRole("button", `${mother}，妈妈，查看它的家族`).tap();
  await expect(screen.getByRole("heading", `${mother}的家族`)).toBeVisible();
  const motherApiPath = `/api/v2/pandas/${new URL(await browser.url()).pathname.split("/")[2]}`;
  await screen.getByRole("button", "返回").tap();
  await expect(screen.getByRole("heading", `${panda.name}的家族`)).toBeVisible();
  const before = requests.length;
  await screen.getByRole("button", `${mother}，妈妈，查看它的家族`).tap();
  await expect(screen.getByRole("heading", `${mother}的家族`)).toBeVisible();
  expect(requests.slice(before).filter((path) => path === motherApiPath || path === "/api/v2/lineage")).toEqual([]);
});
