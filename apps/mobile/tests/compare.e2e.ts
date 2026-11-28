import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { test } from "./support/test.ts";

test("/compare shows core archive comparison, calm fallback, and opens pre-filled /relationship", async ({ app, screen }) => {
  const { panda, notice } = fixture();
  const mother = `选项丙${runSuffix()}`;

  await app.open(`/compare?a=${panda.slug}&b=${notice.slug}`);
  await expect(screen.getByRole("heading", `${panda.name}和${notice.name}`)).toBeVisible();
  await expect(screen.getByRole("heading", "核心档案对照")).toBeVisible();
  await expect(screen.getByText("2020.07.20")).toBeVisible();
  await expect(screen.getByRole("heading", "外貌辨识")).toBeVisible();
  await expect(screen.getByText("两位大熊猫的外貌辨识笔录暂未整理", { exact: false })).toBeVisible();
  await expect(screen.getByText("还缺这些", { exact: false })).toHaveCount(0);

  const kinshipLink = screen.getByRole("link", new RegExp(`^${notice.name}是${panda.name}的同母异父的兄弟姐妹`));
  await expect(kinshipLink).toBeVisible();
  await kinshipLink.tap();

  await expect(screen.getByRole("heading", `${notice.name}是${panda.name}的同母异父的兄弟姐妹`)).toBeVisible();
  await expect(screen.getByRole("button", `妈妈：${mother}`)).toBeVisible();
});

test("legacy /comparisons and /week routes redirect cleanly", async ({ app, screen }) => {
  await app.open("/comparisons");
  await expect(screen.getByRole("heading", "并排比一比")).toBeVisible();
  await expect(screen.getByRole("button", "选第一只，未选")).toBeVisible();

  await app.open("/week");
  await expect(screen.getByRole("heading", "那年今天")).toBeVisible();
  await expect(screen.getByRole("radio", "本周")).toBeVisible();
});
