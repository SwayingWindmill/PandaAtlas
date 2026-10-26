import { expect, test } from "@playwright/test";

import { fixture } from "./fixture";

test("a profile's photos open in a viewer with their credits", async ({ page }) => {
  const { panda } = fixture();
  await page.goto(`/pandas/${panda.slug}`);
  await page.getByRole("button", { name: `查看${panda.name}的照片，共 2 张` }).click();
  const viewer = page.getByRole("dialog", { name: "照片" });
  await expect(viewer.getByText("1 / 2")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "上一张" })).toBeDisabled();
  await expect(viewer.getByText("照片 E2E Photographer / CC BY 4.0，CC-BY-4.0")).toBeVisible();

  await viewer.getByRole("button", { name: "下一张" }).click();
  await expect(viewer.getByText("2 / 2")).toBeVisible();
  await expect(viewer.getByRole("button", { name: "下一张" })).toBeDisabled();
  await expect(viewer.getByRole("button", { name: "上一张" })).toBeEnabled();
  await expect(viewer.getByText("照片 E2E Second Photographer / CC BY 4.0，CC-BY-4.0")).toBeVisible();

  await viewer.getByRole("button", { name: "返回" }).click();
  await expect(page.getByRole("heading", { name: panda.name })).toBeVisible();
});

test("a profile lists its sources and opens one in the browser", async ({ page }) => {
  const { panda } = fixture();
  // The fixture source's address does not resolve; answer it so the opened tab lands on it.
  await page.context().route("https://example.test/**", (route) => route.fulfill({ body: "source" }));
  await page.goto(`/pandas/${panda.slug}`);
  await expect(page.getByRole("heading", { name: "资料来源" })).toBeVisible();
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "E2E Archive，End-to-end fixture source" }).click();
  expect((await popup).url()).toContain("example.test/e2e/");
});
