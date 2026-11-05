import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { openedTabs, recordOpenedTabs } from "./support/opened-tabs.ts";
import { test } from "./support/test.ts";

test("a profile's photos open in a viewer with their credits", async ({ app, screen }) => {
  const { panda } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await screen.getByRole("button", `查看${panda.name}的照片，共 2 张`).tap();
  const viewer = screen.getByRole("dialog", "照片");
  await expect(viewer.getByText("1 / 2")).toBeVisible();
  await expect(viewer.getByRole("button", "上一张")).toBeDisabled();
  await expect(viewer.getByText("照片 E2E Photographer / CC BY 4.0，CC-BY-4.0")).toBeVisible();

  await viewer.getByRole("button", "下一张").tap();
  await expect(viewer.getByText("2 / 2")).toBeVisible();
  await expect(viewer.getByRole("button", "下一张")).toBeDisabled();
  await expect(viewer.getByRole("button", "上一张")).toBeEnabled();
  await expect(viewer.getByText("照片 E2E Second Photographer / CC BY 4.0，CC-BY-4.0")).toBeVisible();

  // The viewer is a stack screen; its back is the bar's own link, outside the dialog.
  await screen.getByRole("link", /^返回/).tap();
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
});

test("a profile lists its sources and opens one in the browser", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  await recordOpenedTabs(browser);
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", "资料来源")).toBeVisible();
  await screen.getByRole("link", /^E2E Archive，End-to-end fixture source，/).tap();
  await expect.poll(async () => (await openedTabs(browser)).some((url) => url.includes("example.test/e2e/"))).toBe(true);
});
