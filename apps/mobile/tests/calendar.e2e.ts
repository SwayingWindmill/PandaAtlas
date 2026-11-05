import type { Screen } from "e2e";
import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

/** Steps the calendar month by month to July 2026, where the fixture panda (born 2020-07-20) turns six. */
async function goToJuly2026(screen: Screen): Promise<void> {
  const now = new Date();
  const steps = (2026 - now.getFullYear()) * 12 + (7 - (now.getMonth() + 1));
  // Named with the month it goes to: 上个月，10月.
  const button = screen.getByRole("button", steps < 0 ? /^上个月，/ : /^下个月，/);
  for (let step = 0; step < Math.abs(steps); step += 1) await button.tap();
  await expect(screen.getByRole("heading", "2026年7月")).toBeVisible();
}

test("the calendar walks to July and opens a panda from its birthday", async ({ app, screen }) => {
  const { panda } = fixture();
  await app.open("/");
  await screen.getByRole("link", "日历").tap();
  const now = new Date();
  await expect(screen.getByRole("heading", `${now.getFullYear()}年${now.getMonth() + 1}月`)).toBeVisible();

  await goToJuly2026(screen);
  await screen.getByRole("button", /^7月20日，\d+ 件$/).tap();
  await expect(screen.getByText("7月20日 周一")).toBeVisible();
  await screen.getByRole("button", `${panda.name}，6 岁生日`).tap();
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
});

test("我关注的 keeps only the followed pandas' days", async ({ app, screen }) => {
  const { panda } = fixture();
  await signIn(app, screen, testEmail("calendar"));
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `关注${panda.name}`).tap();
  await expect(screen.getByRole("button", `已关注${panda.name}，点按取消`)).toBeVisible();

  await app.open("/calendar");
  await goToJuly2026(screen);
  await screen.getByRole("radio", "我关注的").tap();
  await expect(screen.getByRole("button", `${panda.name}，6 岁生日`)).toBeVisible();
  await expect(screen.getByRole("button", /岁生日$/)).toHaveCount(1);
});
