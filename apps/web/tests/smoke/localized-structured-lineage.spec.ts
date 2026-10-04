import { expect, test } from "@playwright/test";

test("renders the current structured lineage route from the V2 fixture", async ({ page }) => {
  await page.goto("/en/families?view=lineage&focus=xi-lun");

  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/families\?view=lineage&focus=xi-lun$/);
});

test("standalone lineage routes stay retired", async ({ request }) => {
  for (const path of ["/lineage", "/en/lineage", "/zh/lineage"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  }
});
