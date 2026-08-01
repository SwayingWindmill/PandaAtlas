import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { isDeployedFeatureEnabled } from "../fixtures/deployment-features";

const engagementEnabled = isDeployedFeatureEnabled("engagement");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const AXE_ROUTE_SCAN_TIMEOUT_MS = 60_000;
const TRANSPARENT_MAP_TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl8sAAAAASUVORK5CYII=",
  "base64",
);

async function scanForWcagViolations(page: Page, testInfo: TestInfo, attachmentName: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  await testInfo.attach(attachmentName, {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: "application/json",
  });
  testInfo.annotations.push({
    type: "axe-incomplete",
    description: `${attachmentName}: ${results.incomplete.length}`,
  });

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

const coreJourneys = [
  { name: "Chinese Editorial Home", path: "/zh" },
  { name: "English Editorial Home", path: "/en" },
  { name: "Chinese My Pandas", path: "/zh/me/passport" },
  { name: "English My Pandas", path: "/en/me/passport" },
  { name: "Chinese Atlas discovery", path: "/zh/pandas?status=alive&sort=name" },
  { name: "English Atlas discovery", path: "/en/pandas?status=alive&sort=name" },
  { name: "Chinese trusted profile", path: "/zh/pandas/mei-xiang" },
  { name: "English trusted profile", path: "/en/pandas/mei-xiang" },
  { name: "Chinese structured map journey", path: "/zh/map?mode=institutions&snapshot=2026.07.31.1" },
  { name: "English structured map journey", path: "/en/map?mode=wild&snapshot=2026.07.31.1" },
  { name: "Chinese institution entity", path: "/zh/institutions/smithsonian-national-zoo" },
  { name: "English institution entity", path: "/en/institutions/smithsonian-national-zoo" },
  { name: "Chinese place entity", path: "/zh/places/wolong-shenshuping-base" },
  { name: "English place entity", path: "/en/places/wolong-shenshuping-base" },
  {
    name: "Chinese structured lineage relationship content",
    path: "/zh/lineage?focus=mei-xiang",
  },
  {
    name: "English structured lineage relationship content",
    path: "/en/lineage?focus=bao-li&descendants=1",
  },
  {
    name: "Chinese Panda Moments with derived anniversaries",
    path: "/zh/moments?year=2026&anniversaries=1&panda=xi-lun",
  },
  {
    name: "English Panda Moments empty state",
    path: "/en/moments?year=1800&panda=mei-xiang",
  },
  {
    name: "Chinese Smithsonian Family Story",
    path: "/zh/families/smithsonian-generations",
  },
  {
    name: "English Ueno twins Family Story",
    path: "/en/families/ueno-twins",
  },
];

for (const journey of coreJourneys) {
  test(`${journey.name} has no automated WCAG A/AA violations`, async ({ page }, testInfo) => {
    testInfo.setTimeout(AXE_ROUTE_SCAN_TIMEOUT_MS);
    await page.goto(journey.path);
    await expect(page.locator("main").first()).toBeVisible();

    await scanForWcagViolations(page, testInfo, "axe-desktop-initial");
  });

  test(`${journey.name} remains accessible at a mobile viewport`, async ({ page }, testInfo) => {
    testInfo.setTimeout(AXE_ROUTE_SCAN_TIMEOUT_MS);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(journey.path);
    await expect(page.locator("main").first()).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await scanForWcagViolations(page, testInfo, "axe-mobile-initial");
  });
}

test("bilingual profile content declares its language", async ({ page }) => {
  for (const { path, language } of [
    { path: "/zh/pandas/mei-xiang", language: "zh-CN" },
    { path: "/en/pandas/mei-xiang", language: "en" },
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.getByTestId("trusted-panda-profile")).toHaveAttribute("lang", language);
  }
});

for (const { locale, path, buttonName, pressedButtonName } of [
  { locale: "zh", path: "/zh/pandas/mei-xiang", buttonName: /^关注/, pressedButtonName: /^取消关注/ },
  { locale: "en", path: "/en/pandas/mei-xiang", buttonName: /^Follow /, pressedButtonName: /^Unfollow / },
]) {
  test(`${locale} profile Follow is keyboard operable and remains accessible`, async ({ page }, testInfo) => {
    test.skip(!engagementEnabled, "The deployed Web build intentionally disables Engagement UI.");
    await page.route("**/api/identity/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          account_id: "11111111-1111-1111-1111-111111111111",
          email: "member@example.invalid",
          state: "active",
          roles: ["member"],
          capabilities: ["account.session.read"],
          recent_auth: true,
          authenticated_at: "2026-07-29T00:00:00Z",
          authentication_method: "otp",
          assurance_level: "aal1",
          expires_at: "2026-07-29T01:00:00Z",
        }),
      });
    });
    await page.route("**/api/engagement/follows/**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 404, contentType: "application/json", body: '{"detail":"Not found"}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          follow_id: "33333333-3333-3333-3333-333333333333",
          panda_id: "stable-panda-mei-xiang",
          state: "active",
          first_followed_at: "2026-07-29T00:00:00Z",
          followed_at: "2026-07-29T00:00:00Z",
          unfollowed_at: null,
          version: 1,
        }),
      });
    });
    await page.goto(path);
    const follow = page.getByRole("button", { name: buttonName });
    await expect(follow).toBeEnabled();
    await follow.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: pressedButtonName })).toHaveAttribute("aria-pressed", "true");
    await scanForWcagViolations(page, testInfo, `axe-keyboard-follow-${locale}`);
  });
}

test("bilingual profiles tolerate a simulated 200-percent text-only resize", async ({ page }) => {
  for (const path of ["/zh/pandas/mei-xiang", "/en/pandas/mei-xiang"]) {
    await page.goto(path);
    await page.locator("body").evaluate((body) => {
      const elements = [body, ...body.querySelectorAll<HTMLElement>("*")];
      const originalFontSizes = elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));

      elements.forEach((element, index) => {
        const originalFontSize = originalFontSizes[index];
        if (Number.isFinite(originalFontSize) && originalFontSize > 0) {
          (element as HTMLElement).style.fontSize = `${originalFontSize * 2}px`;
        }
      });
    });

    const overflowing = await page.locator("*").evaluateAll((elements) => elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element instanceof HTMLElement ? element.className : "",
          text: element.textContent?.trim().slice(0, 80) ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter((item) => item.left < -1 || item.right > innerWidth + 1));
    expect(overflowing).toEqual([]);
    await expect(page.getByTestId("footprint-text-view")).toBeVisible();
  }
});

test("bilingual Editorial Home tolerates a simulated 200-percent text-only resize", async ({ page }) => {
  for (const path of ["/zh", "/en"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await page.locator("body").evaluate((body) => {
      const elements = [body, ...body.querySelectorAll<HTMLElement>("*")];
      const originalFontSizes = elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));

      elements.forEach((element, index) => {
        const originalFontSize = originalFontSizes[index];
        if (Number.isFinite(originalFontSize) && originalFontSize > 0) {
          (element as HTMLElement).style.fontSize = `${originalFontSize * 2}px`;
        }
      });
    });

    const overflowing = await page.locator("*").evaluateAll((elements) => elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: element instanceof HTMLElement ? element.className : "",
          text: element.textContent?.trim().slice(0, 80) ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter((item) => item.left < -1 || item.right > innerWidth + 1));
    expect(overflowing).toEqual([]);
    await expect(page.getByTestId("archive-method")).toBeVisible();
  }
});

test("structured map filters remain keyboard operable and accessible", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/map?mode=institutions&snapshot=2026.07.31.1");
  const form = page.getByRole("form", { name: "Find pandas and places on the map" });
  await form.getByLabel("Panda, zoo, base, or region").fill("Smithsonian");
  await form.getByLabel("Country or region").selectOption("US");
  await form.getByRole("button", { name: "Show results" }).focus();
  await Promise.all([
    page.waitForURL(
      (url) => url.searchParams.get("focus") === "Smithsonian" && url.searchParams.get("country") === "US",
      { waitUntil: "domcontentloaded" },
    ),
    page.keyboard.press("Enter"),
  ]);
  await expect(page.getByRole("heading", { level: 3, name: "Smithsonian's National Zoo" })).toBeVisible();
  await scanForWcagViolations(page, testInfo, "axe-mobile-structured-map-filtered");
});

test("reduced-motion removes nonessential animation from core journeys", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const path of [
    "/zh",
    "/en",
    "/zh/pandas?status=alive&sort=name",
    "/en/pandas?status=alive&sort=name",
    "/zh/pandas/mei-xiang",
    "/en/pandas/mei-xiang",
    "/zh/map?mode=institutions&snapshot=2026.07.31.1",
    "/en/map?mode=wild&snapshot=2026.07.31.1",
    "/zh/lineage?focus=mei-xiang",
    "/en/lineage?focus=bao-li&descendants=1",
  ]) {
    await page.goto(path);
    const movingElements = await page.locator("*").evaluateAll((elements) =>
      elements
        .filter((element) => {
          const root = element.getRootNode();
          return !(root instanceof ShadowRoot && root.host.tagName.toLowerCase() === "nextjs-portal");
        })
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.classList.length ? `.${Array.from(element.classList).join(".")}` : ""}`,
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            animationIterationCount: style.animationIterationCount,
            transitionProperty: style.transitionProperty,
            transitionDuration: style.transitionDuration,
          };
        })
        .filter(({ animationName, animationDuration, animationIterationCount, transitionProperty, transitionDuration }) => {
          const animationDurations = animationDuration
            .split(",")
            .map((value) => Number.parseFloat(value) || 0);
          const transitionDurations = transitionDuration
            .split(",")
            .map((value) => Number.parseFloat(value) || 0);
          const hasAnimation = animationName !== "none"
            && (Math.max(...animationDurations) > 0.01 || animationIterationCount === "infinite");
          const hasTransition = transitionProperty !== "none"
            && Math.max(...transitionDurations) > 0.01;
          return hasAnimation || hasTransition;
        }),
    );

    expect(movingElements, `${path} retains motion under prefers-reduced-motion`).toEqual([]);
  }
});

test("activated map visualization remains keyboard-equivalent and accessible", async ({ page }, testInfo) => {
  await page.route("https://basemaps.cartocdn.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TRANSPARENT_MAP_TILE,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/map?mode=institutions&snapshot=2026.07.31.1");
  await page.getByTestId("activate-map-visualization").click();

  const island = page.getByTestId("map-visualization-island");
  const failure = page.getByTestId("map-visualization-failure");
  await expect.poll(async () => {
    if (await island.isVisible()) return "island";
    if (await failure.isVisible()) return "failure";
    return "loading";
  }, { timeout: 15_000 }).toMatch(/island|failure/);

  if (await island.isVisible()) {
    await expect(island).toHaveAttribute(
      "data-provider-status",
      /ready|degraded|offline|recovering/,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("region", { name: "Interactive panda map" })).toBeVisible();
    await expect(page.getByLabel("Choose without dragging the map")).toBeVisible();
    await expect(page.locator(".pa-map-visualization-attribution").getByRole("link")).toHaveCount(2);
  } else {
    await expect(failure).toContainText("The live map cannot be opened right now");
    await expect(page.getByRole("heading", { level: 3, name: "Smithsonian's National Zoo" })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  await scanForWcagViolations(page, testInfo, "axe-mobile-activated-map-visualization");
});
