import { expect, test } from "@playwright/test";
import { createMapViewport, mapViewportEquals, mapViewportToQuery } from "@/components/atlas/map-viewport";

test("normalizes map viewport values for API queries", () => {
  const viewport = createMapViewport(
    { west: 100.1234567, south: 25.7654321, east: 110.9876549, north: 36.1234567 },
    6.8
  );

  expect(viewport).toEqual({
    bbox: [100.12346, 25.76543, 110.98765, 36.12346],
    zoom: 6
  });
  expect(mapViewportToQuery(viewport)).toEqual({
    bbox: "100.12346,25.76543,110.98765,36.12346",
    zoom: 6
  });
  expect(
    mapViewportEquals(
      viewport,
      createMapViewport(
        { west: 100.12345669, south: 25.76543209, east: 110.98765491, north: 36.12345671 },
        6.81
      )
    )
  ).toBe(true);
  expect(() => createMapViewport({ west: 100, south: 25, east: 100, north: 36 }, 6)).toThrow(
    /valid map bounds/
  );
});

function distributionPayload(zoom: number, truncated = false) {
  return {
    type: "FeatureCollection",
    features: [],
    meta: {
      truncated,
      limit: 1500,
      requested_zoom: zoom,
    },
  };
}

test("queries distribution data from the current map viewport", async ({ page }) => {
  const requests: URL[] = [];

  await page.route("**/api/v1/map/distribution?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    requests.push(requestUrl);
    const zoom = Number(requestUrl.searchParams.get("zoom") ?? 0);
    await route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(distributionPayload(zoom, true)),
    });
  });

  await page.goto("/global-distribution");
  await expect(page.getByTestId("global-distribution-shell")).toBeVisible();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await page.waitForTimeout(400);

  const firstRequestCount = requests.length;
  const firstRequest = requests.at(-1)!;
  const firstBBox = firstRequest.searchParams.get("bbox");
  const firstZoom = Number(firstRequest.searchParams.get("zoom"));

  expect(firstBBox).toMatch(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/);
  await expect(page.getByText(/当前视野的数据超过返回上限/)).toBeVisible();

  await page.getByRole("button", { name: "放大地图" }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(firstRequestCount);

  const nextRequest = requests.at(-1)!;
  expect(nextRequest.searchParams.get("bbox")).not.toBe(firstBBox);
  expect(Number(nextRequest.searchParams.get("zoom"))).toBeGreaterThanOrEqual(firstZoom);
});

test("retries the current viewport after a distribution request fails", async ({ page }) => {
  let shouldSucceed = false;
  const requests: URL[] = [];

  await page.route("**/api/v1/map/distribution?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    requests.push(requestUrl);
    if (!shouldSucceed) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ detail: "offline" }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(distributionPayload(Number(requestUrl.searchParams.get("zoom") ?? 0))),
    });
  });

  await page.goto("/global-distribution");
  const retryButton = page.getByRole("button", { name: "重新刷新" });
  await expect(retryButton).toBeVisible();
  await page.waitForTimeout(400);
  const failedRequest = requests.at(-1)!;
  const failedRequestCount = requests.length;

  shouldSucceed = true;
  await retryButton.click();
  await expect.poll(() => requests.length).toBeGreaterThan(failedRequestCount);
  await expect(retryButton).toBeHidden();

  const retryRequest = requests.at(-1)!;
  expect(retryRequest.searchParams.get("bbox")).toBe(failedRequest.searchParams.get("bbox"));
  expect(retryRequest.searchParams.get("zoom")).toBe(failedRequest.searchParams.get("zoom"));
});

test("keeps a usable text list when the map cannot initialize", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
  });

  await page.goto("/global-distribution");

  const fallback = page.getByTestId("map-text-fallback");
  await expect(fallback).toBeVisible({ timeout: 10_000 });
  await expect(fallback.getByText("地图暂不可用")).toBeVisible();
  await expect(fallback.getByRole("button").first()).toBeVisible();
});
