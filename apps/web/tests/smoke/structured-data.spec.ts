import { expect, test, type Page } from "@playwright/test";

test("localized panda profile emits canonical Schema.org structured data", async ({ page }) => {
  await page.goto("/en/pandas/mei-xiang");
  const script = page.getByTestId("panda-structured-data");
  await expect(script).toHaveAttribute("type", "application/ld+json");
  const payload = JSON.parse(await script.textContent() ?? "{}") as Record<string, unknown>;

  expect(payload["@context"]).toBe("https://schema.org");
  expect(payload["@type"]).toBe("Thing");
  expect(payload.url).toBe("https://www.zhipanda.com/en/pandas/mei-xiang");
  expect(payload.name).toBe("Mei Xiang");
  expect(payload.identifier).toEqual(expect.objectContaining({
    "@type": "PropertyValue",
    propertyID: "ZhiPanda stable panda ID",
  }));
});

async function structuredData(page: Page, testId: string): Promise<Record<string, unknown>> {
  const script = page.getByTestId(testId);
  await expect(script).toHaveAttribute("type", "application/ld+json");
  return JSON.parse(await script.textContent() ?? "{}") as Record<string, unknown>;
}

test("institution page emits Zoo structured data", async ({ page }) => {
  await page.goto("/en/institutions/smithsonian-national-zoo");
  const payload = await structuredData(page, "institution-structured-data");

  expect(payload["@context"]).toBe("https://schema.org");
  expect(payload["@type"]).toBe("Zoo");
  expect(payload.url).toBe("https://www.zhipanda.com/en/institutions/smithsonian-national-zoo");
  expect(payload.name).toEqual(expect.any(String));
});

test("place page emits Place structured data", async ({ page }) => {
  await page.goto("/en/places/ueno-zoo");
  const payload = await structuredData(page, "place-structured-data");

  expect(payload["@type"]).toBe("Place");
  expect(payload.url).toBe("https://www.zhipanda.com/en/places/ueno-zoo");
  expect(payload.identifier).toEqual(expect.objectContaining({ propertyID: "ZhiPanda stable place ID" }));
});

test("family story emits Article structured data about its members", async ({ page }) => {
  await page.goto("/en/families/ueno-twins");
  const payload = await structuredData(page, "family-structured-data");

  expect(payload["@type"]).toBe("Article");
  expect(payload.url).toBe("https://www.zhipanda.com/en/families/ueno-twins");
  expect(payload.headline).toEqual(expect.any(String));
  expect(payload.about).toEqual(expect.arrayContaining([
    expect.objectContaining({ url: expect.stringMatching(/^https:\/\/www\.zhipanda\.com\/en\/pandas\//) }),
  ]));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.zhipanda.com/en/families/ueno-twins");
});

test("sitemap lists place pages and family stories but not places that redirect to an institution", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/en/places/ueno-zoo", "/zh/families/smithsonian-generations", "/en/families/ueno-twins"]) {
    expect(xml).toContain(`${path}<`);
  }
  expect(xml).not.toContain("/places/smithsonian-national-zoo<");
});

test("root layout links the touch icon and web manifest", async ({ page, request }) => {
  await page.goto("/en");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon.png");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  const manifest = await (await request.get("/manifest.webmanifest")).json() as { icons: Array<{ src: string }> };
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).status()).toBe(200);
  }
});
