import { expect, test } from "@playwright/test";

const INSTITUTION_SLUG = "smithsonian-national-zoo";

test("unlocalized institution routes resolve request language", async ({ request }) => {
  const institution = await request.get(`/institutions/${INSTITUTION_SLUG}?from=map`, {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });

  expect(institution.status()).toBe(308);
  expect(institution.headers().location).toBe(`/en/institutions/${INSTITUTION_SLUG}?from=map`);
});

test("does not publish a canonical page for an unsupported compatibility facility", async ({ request }) => {
  const response = await request.get("/en/institutions/ccrcgp-wolong-gengda-base");
  expect(response.status()).toBe(404);
});

test("institution pages remain readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto(`/en/institutions/${INSTITUTION_SLUG}`);
  await expect(page.getByTestId("institution-entity-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Public sources" })).toBeVisible();
  await context.close();
});
