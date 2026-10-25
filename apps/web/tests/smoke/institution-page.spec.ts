import { expect, test } from "@playwright/test";

test("an institution page shows its pandas, visit guide and sources", async ({ page }) => {
  const response = await page.goto("/en/institutions/smithsonian-national-zoo");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Smithsonian's National Zoo and Conservation Biology Institute" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch the official live cam" })).toHaveAttribute("href", "https://nationalzoo.si.edu/webcams/panda-cam");
  await expect(page.getByText("No giant pandas live here right now.")).toBeVisible();

  const guide = page.getByTestId("institution-visit-guide");
  await expect(guide.getByText("Usually 8 a.m. to 4 p.m., last entry 3 p.m.")).toBeVisible();
  await expect(guide.getByRole("heading", { level: 4, name: "When to go" })).toBeVisible();
  await expect(guide.getByText("Checked 2026-10-23")).toBeVisible();

  await expect(page.getByRole("link", { name: "Mei Xiang" })).toHaveAttribute("href", "/en/pandas/mei-xiang");
});

test("a facility's place page moves to its institution page; other places stay", async ({ page }) => {
  const moved = await page.request.get("/zh/places/smithsonian-national-zoo?from=map", { maxRedirects: 0 });
  expect(moved.status()).toBe(308);
  expect(new URL(moved.headers().location ?? "", "http://localhost").pathname + new URL(moved.headers().location ?? "", "http://localhost").search)
    .toBe("/zh/institutions/smithsonian-national-zoo?from=map");

  const kept = await page.request.get("/zh/places/zoo-atlanta", { maxRedirects: 0 });
  expect(kept.status()).toBe(200);
  expect((await page.request.get("/zh/institutions/no-such-zoo", { maxRedirects: 0 })).status()).toBe(404);
});
