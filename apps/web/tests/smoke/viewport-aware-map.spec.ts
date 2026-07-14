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

function requestKey(requestUrl: URL) {
  return `${requestUrl.searchParams.get("bbox")}|${requestUrl.searchParams.get("zoom")}`;
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
  await expect.poll(() => requests.length, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(400);

  const firstRequestCount = requests.length;
  const firstRequest = requests.at(-1)!;
  const firstBBox = firstRequest.searchParams.get("bbox");
  const firstZoom = Number(firstRequest.searchParams.get("zoom"));

  expect(firstBBox).toMatch(/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/);
  await expect(page.getByText(/当前视野的数据超过返回上限/)).toBeVisible();

  await page.getByRole("button", { name: "放大地图" }).click();
  await expect
    .poll(
      () =>
        requests
          .slice(firstRequestCount)
          .some(
            (requestUrl) =>
              requestUrl.searchParams.get("bbox") !== firstBBox &&
              Number(requestUrl.searchParams.get("zoom")) >= firstZoom,
          ),
      { timeout: 15_000 },
    )
    .toBe(true);

  const nextRequest = requests
    .slice(firstRequestCount)
    .find(
      (requestUrl) =>
        requestUrl.searchParams.get("bbox") !== firstBBox &&
        Number(requestUrl.searchParams.get("zoom")) >= firstZoom,
    )!;
  expect(nextRequest.searchParams.get("bbox")).not.toBe(firstBBox);
  expect(Number(nextRequest.searchParams.get("zoom"))).toBeGreaterThanOrEqual(firstZoom);
});

test("retries the current viewport after a distribution request fails", async ({ page }) => {
  let failNextRequest = false;
  let failedRequestKey: string | null = null;
  const successfulRequestKeys: string[] = [];
  const postFailureRequestKeys: string[] = [];

  await page.route("**/api/v1/map/distribution?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const key = requestKey(requestUrl);
    if (failNextRequest) {
      failNextRequest = false;
      failedRequestKey = key;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ detail: "offline" }),
      });
      return;
    }

    successfulRequestKeys.push(key);
    if (failedRequestKey !== null) {
      postFailureRequestKeys.push(key);
    }
    await route.fulfill({
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(distributionPayload(Number(requestUrl.searchParams.get("zoom") ?? 0))),
    });
  });

  await page.goto("/global-distribution");
  await expect(page.getByTestId("global-distribution-shell")).toBeVisible();
  await expect.poll(() => successfulRequestKeys.length, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(400);

  failNextRequest = true;
  await page.getByRole("button", { name: "放大地图" }).click();
  await expect.poll(() => failedRequestKey, { timeout: 15_000 }).not.toBeNull();

  const retryButton = page.getByRole("button", { name: "重新刷新" });
  await expect(retryButton).toBeVisible({ timeout: 15_000 });
  const requestCountBeforeRetry = postFailureRequestKeys.length;
  await retryButton.click();
  await expect
    .poll(
      () =>
        postFailureRequestKeys
          .slice(requestCountBeforeRetry)
          .some((key) => key === failedRequestKey),
      { timeout: 15_000 },
    )
    .toBe(true);
  await expect(retryButton).toBeHidden();
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
