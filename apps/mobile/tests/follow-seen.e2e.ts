import { expect } from "e2e";

import { fixture, todayLabel } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
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

test("a signed-out fan is sent to sign in from the follow button", async ({ app, screen }) => {
  const { panda } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", { name: "关注", exact: false }).tap();
  await expect(screen.getByRole("heading", "用邮箱登录")).toBeVisible();
});
