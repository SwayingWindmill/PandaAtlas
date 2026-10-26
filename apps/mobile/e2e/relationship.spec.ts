import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";

// e2e/global-setup.ts publishes a family: 选项丙 is the mother of the fixture panda and of 选项乙.
const run = () => fixture().panda.name.replace("测试熊猫", "");

test("from a profile, 查关系 names a half-sibling and walks the chain through their mother", async ({ page }) => {
  const { panda, notice } = fixture();
  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: "查关系" }).click();
  await expect(page.getByRole("button", { name: `第一只，${panda.name}` })).toBeVisible();

  await page.getByLabel("搜索要选的熊猫").fill(notice.name);
  await page.getByRole("button", { name: `选${notice.name}` }).click();
  await expect(page.getByRole("heading", { name: `${notice.name}是${panda.name}的同母异父的兄弟姐妹` })).toBeVisible();
  await expect(page.getByRole("button", { name: `妈妈：选项丙${run()}` })).toBeVisible();
  await page.getByRole("button", { name: `孩子：${notice.name}` }).click();
  await expect(page.getByRole("heading", { name: notice.name })).toBeVisible();
});

test("from 找熊猫, two picked pandas show as parent and child", async ({ page }) => {
  const { panda } = fixture();
  await page.goto("/find");
  await page.getByRole("button", { name: "查两只熊猫的关系" }).click();

  await page.getByLabel("搜索要选的熊猫").fill(panda.name);
  await page.getByRole("button", { name: `选${panda.name}` }).click();
  await page.getByLabel("搜索要选的熊猫").fill(`选项丁${run()}`);
  await page.getByRole("button", { name: `选选项丁${run()}` }).click();
  await expect(page.getByRole("heading", { name: `选项丁${run()}是${panda.name}的爸爸` })).toBeVisible();

  // 选项乙 and 选项丁 share no ancestor; they are linked through the fixture panda and its mother.
  await page.getByRole("button", { name: `第一只，${panda.name}` }).click();
  await page.getByLabel("搜索要选的熊猫").fill(`选项乙${run()}`);
  await page.getByRole("button", { name: `选选项乙${run()}` }).click();
  await expect(page.getByRole("heading", { name: `选项丁${run()}和选项乙${run()}有亲缘联系` })).toBeVisible();
  await expect(page.getByRole("button", { name: `女儿：${panda.name}` })).toBeVisible();
});
