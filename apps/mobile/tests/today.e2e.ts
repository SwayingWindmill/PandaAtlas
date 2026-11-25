import { expect } from "e2e";

import { runScheduledCycles } from "./support/backend.ts";
import { fixture } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

test("signed out, 探索 shows hero, star pandas, live clock, daily play, sounds, and links to /live without cold boxes", async ({ app, screen }) => {
  await app.open("/");
  await expect(screen.getByRole("heading", "探索")).toBeVisible();
  await expect(screen.getByText("明星熊猫")).toBeVisible();
  await expect(screen.getByText("关注后切为你的关注")).toBeVisible();
  await expect(screen.getByText("此刻谁醒着")).toBeVisible();
  await expect(screen.getByText("每日一玩")).toBeVisible();
  await expect(screen.getByText("听熊猫")).toBeVisible();
  await expect(screen.getByText("关注的最新动态")).toHaveCount(0);
  await expect(screen.getByText("登录并关注熊猫后，它们的新资料会出现在这里。")).toHaveCount(0);

  await screen.getByRole("link", "查看全部直播与作息").tap();
  await expect(screen.getByRole("heading", "此刻直播与作息")).toBeVisible();
});

test("today lists what the latest release changed for a followed panda", async ({ app, screen }) => {
  const { panda } = fixture();
  await signIn(app, screen, testEmail("today"));
  await app.open("/");
  await expect(screen.getByText("关注的最新动态")).toHaveCount(0);

  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `关注${panda.name}`).tap();
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();

  // The fixture release is projected into the updates feed by the scheduled cycle.
  await runScheduledCycles();
  await app.open("/");
  // stack.ts publishes the panda with its parents and its home in this run's release.
  const row = screen.getByRole("button", new RegExp(`^${panda.name}，新收录、家谱有新记录、住处有新记录，`));
  await expect(row).toBeVisible();
  await row.tap();
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
});

test("today shows the pandas whose birthday it is, and the followed ones on top", async ({ app, screen }) => {
  const { panda } = fixture();
  const optionD = panda.name.replace("测试熊猫", "选项丁");
  // stack.ts gives 选项丁 a birthday today. A birthday today takes the head of 今天 as 生日周. The card names
  // three pandas at most, and every run's 选项丁 shares today's birthday, so this run's one is looked for on
  // 那年今天, which lists them all.
  await app.open("/");
  await expect(screen.getByRole("link", /^生日周，[0-9]+ 岁生日，.+，今天$/)).toBeVisible();
  await app.open("/on-this-day");
  // e2e normalizes accessible names (collapsing `　` to an ASCII space) before matching RegExp patterns.
  await expect(screen.getByRole("link", new RegExp(`^[0-9.]+\\s+[0-9]+，${optionD} [0-9]+ 岁生日，`))).toBeVisible();

  await signIn(app, screen, testEmail("strip"));
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `关注${panda.name}`).tap();
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();
  await app.open("/");
  await expect(screen.getByText("你关注的 1 只")).toBeVisible();
  await screen.getByRole("button", panda.name).tap();
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
});

test("sounds section switches active clip and opens 声音图鉴", async ({ app, screen }) => {
  await app.open("/");
  const bambooPill = screen.getByRole("button", "啃竹原声，0:43");
  await expect(bambooPill).toBeVisible();
  await bambooPill.tap();
  await expect(screen.getByText("大熊猫啃竹 ASMR")).toBeVisible();

  await screen.getByRole("link", "声音图鉴").tap();
  await expect(screen.getByRole("heading", "声音图鉴")).toBeVisible();
  await expect(screen.getByText("实听原声", { exact: false })).toBeVisible();
  await expect(screen.getByRole("button", "播放大熊猫轻声鸣叫")).toBeVisible();
  await expect(screen.getByRole("heading", "大熊猫如何发声")).toBeVisible();
});
