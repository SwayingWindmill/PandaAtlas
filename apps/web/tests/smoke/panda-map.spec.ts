import { expect, test } from "@playwright/test";

test("the panda map lists every place with pandas and opens a place card from its dot", async ({ page }) => {
  await page.goto("/en/map");
  await expect(page.getByRole("heading", { level: 1, name: "Where pandas live" })).toBeVisible();
  await expect(page.getByText("Giant pandas live in 2 places around the world, 2 of them outside China.")).toBeVisible();

  const list = page.locator("#map-places");
  await expect(list.getByRole("link", { name: /Smithsonian's National Zoo.*No pandas right now/ }))
    .toHaveAttribute("href", "/en/institutions/smithsonian-national-zoo");
  await expect(list.getByRole("link", { name: /Ueno Zoo.*Ri Ri/ })).toHaveAttribute("href", "/en/places/ueno-zoo");

  // Before hydration a dot is a plain link to its place; wait so the click opens the card instead.
  await page.waitForLoadState("networkidle");
  await page.getByTestId("panda-world-map").getByRole("link", { name: "Ueno Zoo, 1 panda" }).click();
  const card = page.getByRole("dialog", { name: "Ueno Zoo" });
  await expect(card.getByRole("link", { name: /Ueno Zoo/ })).toHaveAttribute("href", "/en/places/ueno-zoo");
  await card.getByRole("button", { name: "Close" }).click();
  await expect(card).toHaveCount(0);
});

test("the panda map works without JavaScript: dots are links to their place", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/zh/map");
  await expect(page.getByTestId("panda-world-map").getByRole("link", { name: "上野动物园，1 只熊猫" }))
    .toHaveAttribute("href", "/zh/places/ueno-zoo");
  await context.close();
});
