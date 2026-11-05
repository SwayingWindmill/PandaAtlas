import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { test } from "./support/test.ts";

// stack.ts publishes a family: 选项丙 is the mother of the fixture panda and of 选项乙, 选项丁 its father.

test("from a family, 查关系 names a half-sibling and walks the chain through their mother", async ({ app, screen }) => {
  const { panda, notice } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  // The family is a segment of the profile; 查关系 lives on the full tree it links to.
  await screen.getByRole("radio", "家族").tap();
  await screen.getByRole("button", "家族树").tap();
  await screen.getByRole("button", "查关系").tap();
  await expect(screen.getByRole("button", `第一只，${panda.name}`)).toBeVisible();

  await screen.getByLabel("搜索要选的熊猫").fill(notice.name);
  await screen.getByRole("button", `选${notice.name}`).tap();
  await expect(screen.getByRole("heading", `${notice.name}是${panda.name}的同母异父的兄弟姐妹`)).toBeVisible();
  await expect(screen.getByRole("button", `妈妈：选项丙${runSuffix()}`)).toBeVisible();
  await screen.getByRole("button", `孩子：${notice.name}`).tap();
  await expect(screen.getByRole("heading", notice.name)).toBeVisible();
});

test("from 找熊猫, two picked pandas show as parent and child", async ({ app, screen }) => {
  const { panda } = fixture();
  const father = `选项丁${runSuffix()}`;
  const halfSister = `选项乙${runSuffix()}`;
  await app.open("/find");
  await screen.getByRole("button", "查两只熊猫的关系").tap();

  await screen.getByLabel("搜索要选的熊猫").fill(panda.name);
  await screen.getByRole("button", `选${panda.name}`).tap();
  await screen.getByLabel("搜索要选的熊猫").fill(father);
  await screen.getByRole("button", `选${father}`).tap();
  await expect(screen.getByRole("heading", `${father}是${panda.name}的爸爸`)).toBeVisible();

  await screen.getByRole("button", "交换熊猫").tap();
  await expect(screen.getByRole("heading", `${panda.name}是${father}的女儿`)).toBeVisible();
  await screen.getByRole("button", "交换熊猫").tap();

  // 选项乙 and 选项丁 share no ancestor; they are linked through the fixture panda and its mother.
  await screen.getByRole("button", `第一只，${panda.name}`).tap();
  await screen.getByLabel("搜索要选的熊猫").fill(halfSister);
  await screen.getByRole("button", `选${halfSister}`).tap();
  await expect(screen.getByRole("heading", `${father}和${halfSister}有亲缘联系`)).toBeVisible();
  await expect(screen.getByRole("button", `女儿：${panda.name}`)).toBeVisible();
});
