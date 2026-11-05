import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";

const run = () => fixture().panda.name.replace("测试熊猫", "");

test("a profile states sex, birth, home and parents, and lists the places it has lived", async ({ page }) => {
  const { panda, zoo } = fixture();
  await page.goto(`/pandas/${panda.slug}`);
  await expect(page.getByRole("heading", { name: panda.name })).toBeVisible();
  // The facts sit in the name line and the stat tiles; each tile reads as one sentence.
  await expect(page.getByLabel(/雌性$/)).toBeVisible();
  await expect(page.getByLabel("生日，7.20，已确认")).toBeVisible();
  await expect(page.getByRole("link", { name: "所在地，成都" })).toBeVisible();
  await expect(page.getByRole("button", { name: `父母，妈妈选项丙${run()}，爸爸选项丁${run()}` })).toBeVisible();

  // The places it has lived are on its 时间线, under 动态.
  await page.getByRole("radio", { name: "动态" }).click();
  await page.getByRole("button", { name: "时间线" }).click();
  await expect(page.getByRole("heading", { name: `${panda.name}的时间线` })).toBeVisible();
  await expect(page.getByText(/住过 1 个地方/)).toBeVisible();
  await expect(page.getByText(`住进${zoo.facility}`)).toBeVisible();
});

test("a sparse profile says what is unknown and asks fans to tell us", async ({ page }) => {
  const { panda, notice } = fixture();
  // 选项乙 has no photo, no recorded sex, birth or home, and no life events.
  await page.goto(`/pandas/${notice.slug}`);
  await expect(page.getByRole("heading", { name: notice.name })).toBeVisible();
  await expect(page.getByText("暂无照片")).toBeVisible();
  await expect(page.getByLabel("生日，未记录")).toBeVisible();
  await page.getByRole("radio", { name: "动态" }).click();
  await page.getByRole("button", { name: "知道它的经历？告诉我们" }).click();
  await expect(page.getByText("登录后才能纠错")).toBeVisible();

  // The fixture panda's events are empty too, but it has a photo.
  await page.goto(`/pandas/${panda.slug}`);
  await expect(page.getByText("暂无照片")).toHaveCount(0);
});

test("找熊猫's area chips narrow the list to pandas living there", async ({ page }) => {
  const { panda, notice } = fixture();
  await page.goto("/find");
  // The fixture panda lives at the fixture zoo, which is in Chengdu.
  await page.getByRole("button", { name: "成都", exact: true }).click();
  await page.getByLabel("搜索熊猫").fill(panda.name.replace("测试熊猫", ""));
  await expect(page.getByRole("button", { name: new RegExp(`^${panda.name}`) })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(`^${notice.name}`) })).toHaveCount(0);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^${notice.name}`) })).toBeVisible();
});
