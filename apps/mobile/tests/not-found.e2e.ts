import { expect } from "e2e";

import { test } from "./support/test.ts";

test("an unknown deep link shows 找不到页面 and 回首页 leads to 探索", async ({ app, screen }) => {
  await app.open("/no-such-page/at-all");
  await expect(screen.getByText("这个链接可能已经失效，或者页面已经搬走了。")).toBeVisible();
  await screen.getByRole("button", "回首页").tap();
  await expect(screen.getByRole("heading", "探索")).toBeVisible();
  await expect(screen.getByText("这个链接可能已经失效，或者页面已经搬走了。")).toHaveCount(0);
});
