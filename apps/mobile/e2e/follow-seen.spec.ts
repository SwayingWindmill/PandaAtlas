import { expect, test } from "@playwright/test";

import { fixture, todayLabel } from "./fixture";
import { signIn, testEmail } from "./session";

test("a signed-in fan follows a panda and marks it seen, and both survive a reload", async ({ page }) => {
  const { panda } = fixture();
  await signIn(page, testEmail("follow"));

  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: `关注${panda.name}` }).click();
  await expect(page.getByRole("button", { name: `已关注${panda.name}，点按取消` })).toBeVisible();
  await page.getByRole("button", { name: `记下见过${panda.name}` }).click();
  await expect(page.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: `已关注${panda.name}，点按取消` })).toBeVisible();
  await expect(page.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await page.goto("/me");
  await expect(page.getByText("关注的熊猫　1")).toBeVisible();
  await expect(page.getByText(panda.name)).toBeVisible();

  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: `已关注${panda.name}，点按取消` }).click();
  await page.getByRole("button", { name: `${todayLabel()}见过${panda.name}，点按取消` }).click();
  await expect(page.getByRole("button", { name: `关注${panda.name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `记下见过${panda.name}` })).toBeVisible();

  await page.goto("/me");
  await expect(page.getByText("关注的熊猫　0")).toBeVisible();
});

test("a signed-out fan is sent to sign in from the follow button", async ({ page }) => {
  const { panda } = fixture();
  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: "关注" }).click();
  await expect(page.getByRole("heading", { name: "用邮箱登录" })).toBeVisible();
});
