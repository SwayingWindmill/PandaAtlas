import { expect } from "e2e";

import { fixture, todayLabel } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

test("a fan puts a panda in a new collection, finds it in 我的, renames, empties and deletes it", async ({ app, screen }) => {
  const { panda } = fixture();
  await signIn(app, screen, testEmail("collections"));
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", "更多").tap();
  await screen.getByRole("menuitem", "加入合集").tap();
  await screen.getByLabel("新合集的名字").fill("最喜欢");
  await screen.getByRole("button", "新建并加入").tap();
  await expect(screen.getByRole("button", { name: "最喜欢", pressed: true })).toBeVisible();

  await app.open("/me");
  await screen.getByRole("button", "我的合集").tap();
  await screen.getByRole("button", "最喜欢，1 只").tap();
  await expect(screen.getByRole("heading", "最喜欢")).toBeVisible();
  await expect(screen.getByRole("button", new RegExp(`^${panda.name}`))).toBeVisible();

  await screen.getByRole("button", "改名字").tap();
  await screen.getByRole("textbox", "合集的名字").fill("常去看的");
  await screen.getByRole("button", "完成").tap();
  await expect(screen.getByRole("heading", "常去看的")).toBeVisible();

  // Removing is behind 编辑, as a playlist's edit mode.
  await screen.getByRole("button", "编辑合集里的熊猫").tap();
  await screen.getByRole("button", `把${panda.name}移出合集`).tap();
  await expect(screen.getByText("在熊猫的资料页点「加入合集」，它就会放进来。")).toBeVisible();

  await screen.getByRole("button", "删除合集").tap();
  await expect(screen.getByRole("heading", "删除「常去看的」？")).toBeVisible();
  // The confirmation takes the screen, so its 删除合集 is the only one.
  await screen.getByRole("button", "删除合集").tap();
  await expect(screen.getByRole("heading", "我的合集")).toBeVisible();
  await expect(screen.getByRole("button", /^常去看的，/)).toHaveCount(0);
});

test("a fan records a visit on a zoo's page and removes it from 去过的地点", async ({ app, screen }) => {
  const { zoo } = fixture();
  await signIn(app, screen, testEmail("visits"));
  await app.open(`/institutions/${zoo.slug}`);
  await screen.getByRole("button", `记下今天去过${zoo.facility}`).tap();
  await expect(screen.getByText(`${todayLabel()}去过`)).toBeVisible();
  await expect(screen.getByRole("button", `今天已记下去过${zoo.facility}`)).toBeDisabled();

  await app.open("/visits");
  const remove = screen.getByRole("button", new RegExp(`^删除.*去${zoo.facility}的记录$`));
  await expect(remove).toBeVisible();
  await remove.tap();
  await expect(screen.getByText("还没有到访记录。", { exact: false })).toBeVisible();
});

test("signed out, a zoo's page asks the fan to sign in to record a visit", async ({ app, screen }) => {
  const { zoo } = fixture();
  await app.open(`/institutions/${zoo.slug}`);
  await expect(screen.getByRole("button", "登录后记下到访")).toBeVisible();
});
