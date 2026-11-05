import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { enterCode, testEmail } from "./support/session.ts";
// A fresh install, without the journeys' welcome flag.
import { freshInstallTest as test } from "./support/test.ts";

test("first launch welcomes the fan, who signs in, follows two pandas and lands on 今天", async ({ app, screen }) => {
  const { panda, notice } = fixture();
  await app.open("/");
  await expect(screen.getByRole("heading", "先关注几只熊猫")).toBeVisible();

  // The tiles are checkboxes; react-native-web drops accessibilityState, so the picks are read from 已选.
  for (const name of [panda.name, notice.name]) {
    await screen.getByLabel("搜索想关注的熊猫").fill(name);
    await screen.getByRole("checkbox", name).tap();
  }
  await expect(screen.getByText(`已选：${panda.name}、${notice.name}`)).toBeVisible();
  await screen.getByRole("button", "登录并关注这 2 只").tap();
  await enterCode(screen, testEmail("welcome"));
  await screen.getByRole("button", "关注这 2 只").tap();
  await expect(screen.getByRole("heading", "今天")).toBeVisible();

  await app.open("/me");
  await expect(screen.getByLabel("关注 2 只")).toBeVisible();
});

test("skipping the welcome shows it only once", async ({ app, screen, browser }) => {
  await app.open("/");
  await screen.getByRole("button", "先逛逛").tap();
  await expect(screen.getByRole("heading", "今天")).toBeVisible();

  await browser.reload();
  await expect(screen.getByRole("heading", "今天")).toBeVisible();
  await expect(screen.getByRole("heading", "先关注几只熊猫")).toHaveCount(0);
});
