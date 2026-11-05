import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { signIn, testEmail } from "./support/session.ts";
import { test } from "./support/test.ts";

test("signed out, 纠错 asks the fan to sign in first", async ({ app, screen }) => {
  const { panda } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", "更多").tap();
  await screen.getByRole("menuitem", "资料有误").tap();
  await expect(screen.getByText("登录后才能纠错", { exact: false })).toBeVisible();
});

test("a signed-in fan reports a mistake with a source and follows it in 我的", async ({ app, screen }) => {
  const { panda } = fixture();
  await signIn(app, screen, testEmail("correct"));
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", "更多").tap();
  await screen.getByRole("menuitem", "资料有误").tap();
  await expect(screen.getByText(`纠错　${panda.name}`)).toBeVisible();

  await screen.getByRole("button", "提交").tap();
  await expect(screen.getByText("选一项哪里不对。")).toBeVisible();

  await screen.getByRole("radio", "出生日期").tap();
  await expect(screen.getByRole("radio", { name: "出生日期", checked: true })).toBeVisible();
  await expect(screen.getByText("写下正确的内容。")).toBeVisible();
  await screen.getByLabel("正确的是").fill("2020 年 7 月 21 日出生");
  await screen.getByLabel("来源名称").fill("基地公告");
  await screen.getByLabel("来源链接或出处").fill("https://example.test/notice");
  await screen.getByRole("button", "提交").tap();
  await expect(screen.getByRole("heading", "已收到")).toBeVisible();

  await app.open("/contributions");
  await expect(screen.getByRole("button", `${panda.name}，等待审核`)).toBeVisible();
});
