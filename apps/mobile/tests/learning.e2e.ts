import { expect } from "e2e";

import { test } from "./support/test.ts";

// The working copy is unmarked draft text. The local release does not include the real pandas the challenge
// names, so the challenge explains that instead of playing the round.

test("a fan reads the draft 科普 pages", async ({ app, screen }) => {
  await app.open("/");
  await screen.getByRole("link", "认识大熊猫，科普").tap();
  await expect(screen.getByRole("heading", { name: "认识大熊猫", level: 1 })).toBeVisible();

  await screen.getByRole("button", "黑眼圈不是熬夜熬的：大熊猫眼斑从哪来、有什么用").tap();
  await expect(screen.getByText("提到大熊猫，几乎每个人第一个想到的都是那对", { exact: false })).toBeVisible();
  await expect(screen.getByRole("link", "Giant panda")).toBeVisible();
  await expect(screen.getByRole("heading", "黑白配色里最显眼的一笔")).toBeVisible();

  await app.open("/learn");
  await screen.getByRole("button", "亚成体").tap();
  await expect(screen.getByRole("heading", { name: "亚成体", level: 1 })).toBeVisible();
  // The 科普 list under it now shows each term's definition too, so only the visible one is the term page's.
  await expect(screen.getByText("一岁半到性成熟前的大熊猫", { exact: false, visible: true })).toBeVisible();

  await app.open("/learn");
  await screen.getByRole("button", "认脸指南：宝力").tap();
  await expect(screen.getByText("两颊不如青宝蓬松。", { exact: false })).toBeVisible();
  await expect(screen.getByText("脸型")).toBeVisible();
  await expect(screen.getByText("左右差别")).toHaveCount(0);
  await expect(screen.getByText("暂无照片", { visible: true })).toBeVisible();

  await app.open("/learn");
  await screen.getByRole("button", "认脸挑战").tap();
  await expect(screen.getByText("这道题的熊猫还不在当前资料里。", { exact: false })).toBeVisible();
});
