import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { test } from "./support/test.ts";

test("from /find, opens 现场认熊, narrows candidates by venue and traits, and opens /compare", async ({ app, screen }) => {
  const { panda, notice, zoo } = fixture();

  await app.open("/find");
  await screen.getByRole("button", "现场认熊").tap();
  await expect(screen.getByRole("heading", "现场认熊")).toBeVisible();

  await screen.getByRole("button", zoo.name).tap();
  await expect(screen.getByText("候选 1 只")).toBeVisible();
  await expect(screen.getByText(panda.name, { exact: false })).toBeVisible();

  await screen.getByRole("button", "雌").tap();
  await screen.getByRole("button", "成年（6–15 岁）").tap();
  await expect(screen.getByText("命中 2/2")).toBeVisible();

  // Switch back to 全部 so all fixture pandas enter the pool while preserving the ranked Top-3.
  await screen.getByRole("button", "全部").tap();
  const pickPanda = screen.getByRole("button", `加入对比${panda.name}`);
  const pickNotice = screen.getByRole("button", `加入对比${notice.name}`);
  if ((await pickNotice.count()) === 0) {
    const expand = screen.getByRole("button", /^展开其余/);
    if ((await expand.count()) > 0) await expand.tap();
  }
  await pickPanda.tap();
  await pickNotice.tap();

  const compareButton = screen.getByRole("button", `双图比一比：${panda.name} 和 ${notice.name}`);
  await expect(compareButton).toBeVisible();
  await compareButton.tap();

  await expect(screen.getByRole("heading", `${panda.name}和${notice.name}`)).toBeVisible();
});

test("deep-links /identify?institution=<slug> and stays usable offline across restarts", async ({ app, screen, browser }) => {
  const { panda, zoo } = fixture();

  await app.open(`/identify?institution=${zoo.slug}`);
  await expect(screen.getByRole("heading", "现场认熊")).toBeVisible();
  await expect(screen.getByRole("button", zoo.name)).toBeVisible();
  await expect(screen.getByText("候选 1 只")).toBeVisible();
  await expect(screen.getByText(panda.name, { exact: false })).toBeVisible();

  // Go offline and restart the app: persisted list caches keep /identify working without network.
  await browser.route("**/api/v2/**", (route) => route.abort());
  await browser.evaluate(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
    return null;
  });
  await app.restart();

  await app.open(`/identify?institution=${zoo.slug}`);
  await expect(screen.getByRole("heading", "现场认熊")).toBeVisible();
  await expect(screen.getByText("候选 1 只")).toBeVisible();
  await screen.getByRole("button", "雌").tap();
  await expect(screen.getByText("命中 1/1")).toBeVisible();
  await expect(screen.getByText(panda.name, { exact: false })).toBeVisible();
});
