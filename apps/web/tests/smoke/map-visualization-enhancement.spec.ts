import { expect, test, type Page } from "@playwright/test";

const RELEASE_ID = "2026.07.18.1";
const SMITHSONIAN_RESULT = "institution:afb0f227-dd5e-5076-88e3-74e9807a6049";
const TILE_PATTERN = "https://basemaps.cartocdn.com/**";
const TRANSPARENT_TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl8sAAAAASUVORK5CYII=",
  "base64",
);

async function stubProviderTiles(page: Page): Promise<void> {
  await page.route(TILE_PATTERN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_TILE,
    });
  });
}

async function activateMap(page: Page): Promise<void> {
  await page.getByTestId("activate-map-visualization").click();
  await expect(page.getByTestId("map-visualization-island")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".pa-map-visualization-canvas canvas")).toHaveCount(1, { timeout: 15_000 });
}

test("keeps the structured journey usable across optional visual runtime outcomes", async ({ page, browserName }) => {
  test.skip(browserName === "chromium", "Chromium is covered by the full MapLibre runtime contract below.");
  await stubProviderTiles(page);
  await page.goto(`/en/map?mode=institutions&country=US&snapshot=${RELEASE_ID}`);
  await page.getByTestId("activate-map-visualization").click();

  const island = page.getByTestId("map-visualization-island");
  const failure = page.getByTestId("map-visualization-failure");
  await expect.poll(async () => {
    if (await island.isVisible()) return "island";
    if (await failure.isVisible()) return "failure";
    return "loading";
  }, { timeout: 15_000 }).toMatch(/island|failure/);

  if (await island.isVisible()) {
    await expect(island).toHaveAttribute("data-provider-status", /ready|degraded|offline|recovering/);
    await expect(page.getByRole("region", { name: "Interactive map visualization enhancement" })).toBeVisible();
    await expect(page.getByLabel("Non-drag selection")).toBeVisible();
  } else {
    await expect(failure).toContainText("The optional map visualization is unavailable");
  }
  await expect(page.getByTestId(`structured-map-result-${SMITHSONIAN_RESULT}`)).toBeVisible();
});

test.describe("full MapLibre runtime", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== "chromium", "The optional MapLibre runtime is fully exercised in Chromium; other engines verify explicit degradation above.");
  });

test("requests no provider resources before explicit map activation", async ({ page }) => {
  let providerRequests = 0;
  page.on("request", (request) => {
    if (request.url().startsWith("https://basemaps.cartocdn.com/")) providerRequests += 1;
  });
  await stubProviderTiles(page);

  await page.goto(`/en/map?mode=institutions&snapshot=${RELEASE_ID}`);

  await expect(page.getByTestId("activate-map-visualization")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.waitForTimeout(350);
  expect(providerRequests).toBe(0);

  await activateMap(page);
  await expect.poll(() => providerRequests).toBeGreaterThan(0);
  const attribution = page.locator(".pa-map-visualization-attribution");
  await expect(attribution).toContainText("© OpenStreetMap contributors");
  await expect(attribution).toContainText("© CARTO");
  await expect(attribution.getByRole("link")).toHaveCount(2);
});

test("keeps list focus and the same map instance while synchronizing canonical selection", async ({ page }) => {
  await stubProviderTiles(page);
  await page.goto(`/en/map?mode=institutions&country=US&snapshot=${RELEASE_ID}`);
  await activateMap(page);

  const canvas = page.locator(".pa-map-visualization-canvas canvas");
  await canvas.evaluate((element) => element.setAttribute("data-instance-proof", "preserved"));

  const result = page.getByTestId(`structured-map-result-${SMITHSONIAN_RESULT}`);
  const selectLink = result.getByRole("link", { name: "View this result" });
  await selectLink.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`selected=${encodeURIComponent(SMITHSONIAN_RESULT)}`));
  await expect(page.getByTestId("selected-structured-map-result")).toContainText("Smithsonian");
  await expect(page.getByTestId("map-visualization-island")).toContainText("Map selection synchronized");
  await expect(canvas).toHaveAttribute("data-instance-proof", "preserved");
  await expect(selectLink).toBeFocused();
});

test("offers a keyboard non-drag selection path with stable result IDs", async ({ page }) => {
  await stubProviderTiles(page);
  await page.goto(`/en/map?mode=institutions&snapshot=${RELEASE_ID}`);
  await activateMap(page);

  const selector = page.getByLabel("Non-drag selection");
  await selector.selectOption(SMITHSONIAN_RESULT);
  const synchronize = page.getByRole("button", { name: "Select and synchronize details" });
  await synchronize.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`selected=${encodeURIComponent(SMITHSONIAN_RESULT)}`));
  await expect(page.getByTestId("selected-structured-map-result")).toContainText("Smithsonian");
  await expect(synchronize).toBeFocused();
});

test("preserves filters and selection through offline and network recovery", async ({ context, page }) => {
  await stubProviderTiles(page);
  const expectedUrl = `/en/map?mode=institutions&country=US&snapshot=${RELEASE_ID}&selected=${encodeURIComponent(SMITHSONIAN_RESULT)}`;
  await page.goto(expectedUrl);
  await activateMap(page);

  await context.setOffline(true);
  await expect(page.getByTestId("map-visualization-island")).toContainText("Offline");
  await expect(page).toHaveURL(expectedUrl);
  await expect(page.getByTestId("selected-structured-map-result")).toContainText("Smithsonian");

  await context.setOffline(false);
  const island = page.getByTestId("map-visualization-island");
  await expect(island).toHaveAttribute("data-provider-status", /recovering|ready|degraded/, { timeout: 15_000 });
  await expect(island).toContainText(
    /Network restored|Map provider connected|Some map resources are unavailable/,
  );
  await expect(page).toHaveURL(expectedUrl);
  await expect(page.getByLabel("Country scope")).toHaveValue("US");
});

test("degrades provider failure without replacing the structured journey", async ({ page }) => {
  await page.route(TILE_PATTERN, async (route) => route.abort("failed"));
  await page.goto(`/en/map?mode=institutions&country=US&snapshot=${RELEASE_ID}`);
  await activateMap(page);

  await expect(page.getByTestId("map-visualization-island")).toHaveAttribute("data-provider-status", /degraded|offline/);
  await expect(page.getByTestId(`structured-map-result-${SMITHSONIAN_RESULT}`)).toBeVisible();
  await expect(page.getByText("A map canvas is not required to complete this task.")).toBeVisible();
});

test("serializes viewport state and stays within the local query scheduling budget", async ({ page }) => {
  await stubProviderTiles(page);
  await page.goto(`/en/map?mode=institutions&snapshot=${RELEASE_ID}`);
  await activateMap(page);

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page).toHaveURL(/view=-?\d+(?:\.\d+)?%2C-?\d+(?:\.\d+)?%2C\d+(?:\.\d+)?/);
  const metric = page.getByTestId("map-query-p95");
  await expect(metric).toBeVisible();
  const text = await metric.textContent();
  const milliseconds = Number(text?.match(/(\d+) ms/)?.[1]);
  expect(milliseconds).toBeLessThanOrEqual(1200);
});

test("uses the reduced-motion camera path and reflows in portrait and short landscape", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubProviderTiles(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/en/map?mode=institutions&snapshot=${RELEASE_ID}`);
  await activateMap(page);

  await expect(page.getByTestId("map-visualization-island")).toHaveAttribute("data-reduced-motion", "true");
  await expect(page.getByLabel("Non-drag selection")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 667, height: 375 });
  await expect(page.getByRole("button", { name: "Reset view" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
});
