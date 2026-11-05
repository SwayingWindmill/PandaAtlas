import { expect } from "e2e";

import { fixture, todayLabel } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

test("signed out, the 图鉴 says what signing in keeps", async ({ app, screen }) => {
  await app.open("/book");
  await expect(screen.getByText("你的熊猫清单")).toBeVisible();
  await expect(screen.getByRole("button", "先去猜今天的每日一猫")).toBeVisible();
});

test("a panda marked 见过 lights up in the 图鉴", async ({ app, screen }) => {
  const { panda } = fixture();
  await signIn(app, screen, testEmail("book"));
  await app.open("/book");
  await expect(screen.getByLabel(/^点亮 0 只，共收录 [\d,]+ 只，0%$/)).toBeVisible();
  await expect(screen.getByText("从第一只开始")).toBeVisible();

  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `记下见过${panda.name}`).tap();
  await expect(screen.getByText(`见过　${todayLabel()}`)).toBeVisible();

  await app.open("/book");
  await expect(screen.getByLabel(/^点亮 1 只，共收录 [\d,]+ 只，\d+%$/)).toBeVisible();
  await expect(screen.getByRole("link", new RegExp(`^No\\.1，${panda.name}，${todayLabel()}.*见过$`))).toBeVisible();
  await screen.getByRole("radio", "认出").tap();
  await expect(screen.getByRole("link", new RegExp(`^No\\.1，${panda.name}`))).toHaveCount(0);
});
