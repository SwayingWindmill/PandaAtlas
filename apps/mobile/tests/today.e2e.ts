import { expect } from "e2e";

import { runScheduledCycles } from "./support/backend.ts";
import { fixture } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

test("signed out, 今天 explains what following brings", async ({ app, screen }) => {
  await app.open("/");
  await expect(screen.getByText("登录并关注熊猫后，它们的新资料会出现在这里。")).toBeVisible();
});

test("today lists what the latest release changed for a followed panda", async ({ app, screen }) => {
  const { panda } = fixture();
  await signIn(app, screen, testEmail("today"));
  await app.open("/");
  await expect(screen.getByText("还没有关注的熊猫。", { exact: false })).toBeVisible();

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
  await expect(screen.getByRole("link", new RegExp(`^[0-9.]+ · [0-9]+，${optionD} [0-9]+ 岁生日，`))).toBeVisible();

  await signIn(app, screen, testEmail("strip"));
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `关注${panda.name}`).tap();
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();
  await app.open("/");
  await expect(screen.getByText("你关注的 1 只")).toBeVisible();
  await screen.getByRole("button", panda.name).tap();
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
});
