import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { test } from "./support/test.ts";

test("a profile states sex, birth, home and parents, and lists the places it has lived", async ({ app, screen }) => {
  const { panda, zoo } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
  // The facts sit in the name line and the stat tiles; each tile reads as one sentence.
  await expect(screen.getByLabel(/雌性$/)).toBeVisible();
  await expect(screen.getByLabel("生日，7.20，已确认")).toBeVisible();
  await expect(screen.getByRole("link", "所在地，成都")).toBeVisible();
  await expect(screen.getByRole("button", `父母，妈妈选项丙${runSuffix()}，爸爸选项丁${runSuffix()}`)).toBeVisible();

  // The places it has lived are on its 时间线, under 动态.
  await screen.getByRole("radio", "动态").tap();
  await screen.getByRole("button", "时间线").tap();
  await expect(screen.getByRole("heading", `${panda.name}的时间线`)).toBeVisible();
  await expect(screen.getByText(/住过 1 个地方/)).toBeVisible();
  await expect(screen.getByText(`住进${zoo.facility}`)).toBeVisible();
});

test("a sparse profile says what is unknown and asks fans to tell us", async ({ app, screen }) => {
  const { panda, notice } = fixture();
  // 选项乙 has no photo, no recorded sex, birth or home, and no life events.
  await app.open(`/pandas/${notice.slug}`);
  await expect(screen.getByRole("heading", notice.name)).toBeVisible();
  await expect(screen.getByText("暂无照片")).toBeVisible();
  await expect(screen.getByLabel("生日，未记录")).toBeVisible();
  await screen.getByRole("radio", "动态").tap();
  await screen.getByRole("button", "知道它的经历？告诉我们").tap();
  await expect(screen.getByText("登录后才能纠错", { exact: false })).toBeVisible();

  // The fixture panda's events are empty too, but it has a photo.
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
  await expect(screen.getByText("暂无照片")).toHaveCount(0);
});

test("找熊猫's area chips narrow the list to pandas living there", async ({ app, screen }) => {
  const { panda, notice } = fixture();
  await app.open("/find");
  // The fixture panda lives at the fixture zoo, which is in Chengdu.
  await screen.getByRole("button", "成都").tap();
  await screen.getByLabel("搜索熊猫").fill(runSuffix());
  await expect(screen.getByRole("button", new RegExp(`^${panda.name}`))).toBeVisible();
  await expect(screen.getByRole("button", new RegExp(`^${notice.name}`))).toHaveCount(0);
  await screen.getByRole("button", "全部").tap();
  await expect(screen.getByRole("button", new RegExp(`^${notice.name}`))).toBeVisible();
});
