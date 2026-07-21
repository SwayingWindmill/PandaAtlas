import { expect, test } from "@playwright/test";

const RELEASE_ID = "2026.07.21.1";
const INSTITUTION_SLUG = "smithsonian-national-zoo";
const PLACE_SLUG = "smithsonian-national-zoo-washington-dc";


test("renders a canonical institution as an organization distinct from its place", async ({ page }) => {
  await page.goto(`/en/institutions/${INSTITUTION_SLUG}`);

  await expect(page.getByTestId("institution-entity-page")).toBeVisible();
  await expect(page).toHaveTitle(/Smithsonian's National Zoo \| Institution entity/);
  await expect(page.getByRole("heading", { level: 1, name: "Smithsonian's National Zoo" })).toBeVisible();
  await expect(page.getByText("This is an organization record.")).toBeVisible();
  await expect(page.getByText(RELEASE_ID).first()).toBeVisible();
  await expect(page.getByText("Public Schema 1.2.0")).toBeVisible();
  await expect(page.getByRole("link", { name: "Smithsonian's National Zoo, Washington, D.C." })).toHaveAttribute(
    "href",
    `/en/places/${PLACE_SLUG}`,
  );
  await expect(page.getByRole("link", { name: "Bao Li" })).toHaveAttribute("href", "/en/atlas/bao-li");
  await expect(page.getByText("History of Giant Pandas at the Smithsonian's National Zoo and Conservation Biology Institute")).toBeVisible();
});


test("renders a canonical place with explicit locality precision and institution relationship", async ({ page }) => {
  await page.goto(`/zh/places/${PLACE_SLUG}`);

  await expect(page.getByTestId("place-entity-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "史密森国家动物园（华盛顿特区园区）" })).toBeVisible();
  await expect(page.getByText("这是物理场所记录。")).toBeVisible();
  await expect(page.getByText("locality", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "史密森国家动物园", exact: true })).toHaveAttribute(
    "href",
    `/zh/institutions/${INSTITUTION_SLUG}`,
  );
  await expect(page.getByRole("link", { name: "在结构化地图中查看" })).toHaveAttribute(
    "href",
    `/zh/map?mode=institutions&focus=${encodeURIComponent("史密森国家动物园（华盛顿特区园区）")}&snapshot=${RELEASE_ID}`,
  );
});


test("normalizes legacy place slugs and preserves query state", async ({ request }) => {
  const response = await request.get("/en/places/ccrcgp-wolong-shenshuping-base?source=profile#footprint", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/en/places/wolong-shenshuping-base?source=profile");
});


test("unlocalized entity routes resolve request language", async ({ request }) => {
  const institution = await request.get(`/institutions/${INSTITUTION_SLUG}?from=map`, {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(institution.status()).toBe(308);
  expect(institution.headers().location).toBe(`/en/institutions/${INSTITUTION_SLUG}?from=map`);

  const place = await request.get(`/places/${PLACE_SLUG}`, {
    headers: { "accept-language": "zh-CN,zh;q=0.9" },
    maxRedirects: 0,
  });
  expect(place.status()).toBe(308);
  expect(place.headers().location).toBe(`/zh/places/${PLACE_SLUG}`);
});


test("does not publish a canonical page for an unsupported compatibility facility", async ({ request }) => {
  const response = await request.get("/en/institutions/ccrcgp-wolong-gengda-base");
  expect(response.status()).toBe(404);
});


test("Atlas, Map, and profile expose ordinary canonical entity links", async ({ page }) => {
  await page.goto("/en/atlas?q=Smithsonian");
  await expect(page.getByTestId("atlas-entity-results")).toBeVisible();
  await expect(page.getByRole("link", { name: /Smithsonian's National Zoo/ }).first()).toHaveAttribute(
    "href",
    `/en/institutions/${INSTITUTION_SLUG}`,
  );

  await page.goto(`/en/map?mode=institutions&country=US&snapshot=${RELEASE_ID}`);
  const result = page.getByTestId("structured-map-result-institution:afb0f227-dd5e-5076-88e3-74e9807a6049");
  await expect(result.getByRole("link", { name: "Open institution or place entity" })).toHaveAttribute(
    "href",
    `/en/institutions/${INSTITUTION_SLUG}`,
  );

  await page.goto("/en/atlas/bao-li#footprint");
  await expect(page.getByTestId("footprint-text-view").getByRole("link", { name: "Open place entity" })).toHaveAttribute(
    "href",
    `/en/places/${PLACE_SLUG}`,
  );
});


test("entity pages remain readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`/en/institutions/${INSTITUTION_SLUG}`);
  await expect(page.getByTestId("institution-entity-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Public sources" })).toBeVisible();
  await context.close();
});
