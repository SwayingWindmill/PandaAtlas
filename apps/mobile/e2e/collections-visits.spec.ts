import { expect, test } from "@playwright/test";

import { fixture, todayLabel } from "./fixture";
import { signIn, testEmail } from "./session";

test("a fan puts a panda in a new collection, finds it in 我的, renames, empties and deletes it", async ({ page }) => {
  const { panda } = fixture();
  await signIn(page, testEmail("collections"));
  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: "加入合集" }).click();
  await page.getByLabel("新合集的名字").fill("最喜欢");
  await page.getByRole("button", { name: "新建并加入" }).click();
  await expect(page.getByRole("button", { name: "最喜欢", pressed: true })).toBeVisible();

  await page.goto("/me");
  await page.getByRole("button", { name: "我的合集" }).click();
  await page.getByRole("button", { name: "最喜欢，1 只" }).click();
  await expect(page.getByRole("heading", { name: "最喜欢" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`^${panda.name}`) })).toBeVisible();

  await page.getByRole("button", { name: "改名字" }).click();
  await page.getByLabel("合集名字").fill("常去看的");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("heading", { name: "常去看的" })).toBeVisible();

  await page.getByRole("button", { name: `把${panda.name}移出合集` }).click();
  await expect(page.getByText("还是空的。")).toBeVisible();

  await page.getByRole("button", { name: "删除合集" }).click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByRole("heading", { name: "我的合集" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^常去看的，/ })).toHaveCount(0);
});

test("a fan records a visit on a zoo's page and removes it from 去过的地点", async ({ page }) => {
  const { zoo } = fixture();
  await signIn(page, testEmail("visits"));
  await page.goto(`/institutions/${zoo.slug}`);
  await page.getByRole("button", { name: `记下今天去过${zoo.facility}` }).click();
  await expect(page.getByText(`${todayLabel()}去过`)).toBeVisible();
  await expect(page.getByRole("button", { name: `今天已记下去过${zoo.facility}` })).toBeDisabled();

  await page.goto("/visits");
  const remove = page.getByRole("button", { name: new RegExp(`^删除.*去${zoo.facility}的记录$`) });
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(page.getByText("还没有到访记录。", { exact: false })).toBeVisible();
});

test("signed out, a zoo's page asks the fan to sign in to record a visit", async ({ page }) => {
  const { zoo } = fixture();
  await page.goto(`/institutions/${zoo.slug}`);
  await expect(page.getByRole("button", { name: "登录后记下到访" })).toBeVisible();
});
