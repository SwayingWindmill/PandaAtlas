import { expect } from "e2e";

import { fixture, todayLabel } from "./support/fixture.ts";
import { enterCode, signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

test("a signed-in fan follows a panda and marks it seen, and both survive a reload", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  await signIn(app, screen, testEmail("follow"));

  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `关注${panda.name}`).tap();
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();
  await screen.getByRole("button", `记下见过${panda.name}`).tap();
  await expect(screen.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await browser.reload();
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();
  await expect(screen.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await app.open("/me");
  await expect(screen.getByLabel("关注 1 只")).toBeVisible();
  await app.open("/following");
  await expect(screen.getByRole("button", new RegExp(`^${panda.name}`))).toBeVisible();

  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `已关注${panda.name}，点按取消`).tap();
  await screen.getByRole("button", `${todayLabel()}见过${panda.name}，点按取消`).tap();
  await expect(screen.getByRole("button", `关注${panda.name}`)).toBeVisible();
  await expect(screen.getByRole("button", `记下见过${panda.name}`)).toBeVisible();

  await app.open("/me");
  await expect(screen.getByLabel("关注 0 只")).toBeVisible();
});

test("a signed-out guest follows and marks a panda seen locally, survives reload, and syncs upon sign-in", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `关注${panda.name}`).tap();
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();
  await screen.getByRole("button", `记下见过${panda.name}`).tap();
  await expect(screen.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await browser.reload();
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();
  await expect(screen.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await app.open("/me");
  await expect(screen.getByLabel("关注 1 只")).toBeVisible();

  await screen.getByRole("button", "绑定同步").tap();
  await enterCode(screen, testEmail("guest-sync"));
  await expect(screen.getByRole("button", "改名字")).toBeVisible();
  await expect(screen.getByLabel("关注 1 只")).toBeVisible();

  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();
  await expect(screen.getByText(`见过　${todayLabel()}`)).toBeVisible();
});

test("a fan follows a venue and switches to 场馆 in 我的关注", async ({ app, screen }) => {
  const { zoo } = fixture();
  await signIn(app, screen, testEmail("follow-venue"));

  await app.open(`/institutions/${zoo.slug}`);
  await screen.getByRole("button", `关注${zoo.name}`).tap();
  await expect(screen.getByRole("button", `已关注${zoo.name}，点按取消`)).toBeVisible();

  await app.open("/following");
  await expect(screen.getByRole("radio", { name: /^熊猫 0/, checked: true })).toBeVisible();
  await screen.getByRole("radio", /^场馆 1/).tap();
  await expect(screen.getByRole("radio", { name: /^场馆 1/, checked: true })).toBeVisible();
  await expect(screen.getByRole("link", new RegExp(`^${zoo.name}`))).toBeVisible();
  await expect(screen.getByRole("link", `查看${zoo.name}攻略`)).toBeVisible();
});
