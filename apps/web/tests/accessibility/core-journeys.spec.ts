import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { isDeployedFeatureEnabled } from "../fixtures/deployment-features";

const engagementEnabled = isDeployedFeatureEnabled("engagement");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const AXE_ROUTE_SCAN_TIMEOUT_MS = 60_000;
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
  { name: "Chinese Home", path: "/zh" },
  { name: "English Home", path: "/en" },
  { name: "Chinese My Pandas", path: "/zh/me" },
  { name: "English My Pandas", path: "/en/me" },
  { name: "Chinese Atlas discovery", path: "/zh/pandas?status=alive&sort=name" },
  { name: "English Atlas discovery", path: "/en/pandas?status=alive&sort=name" },
  { name: "Chinese trusted profile", path: "/zh/pandas/mei-xiang" },
  { name: "English trusted profile", path: "/en/pandas/mei-xiang" },
  { name: "Chinese panda map", path: "/zh/map" },
  { name: "English panda map", path: "/en/map" },
  { name: "Chinese place entity", path: "/zh/places/wolong-shenshuping-base" },
  { name: "English place entity", path: "/en/places/wolong-shenshuping-base" },
  { name: "Chinese institution page", path: "/zh/institutions/smithsonian-national-zoo" },
  { name: "English institution page", path: "/en/institutions/smithsonian-national-zoo" },
  {
    name: "Chinese structured lineage relationship content",
    path: "/zh/families?view=lineage&focus=mei-xiang",
  },
  {
    name: "English structured lineage relationship content",
    path: "/en/families?view=lineage&focus=bao-li&descendants=1",
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
  { locale: "zh", path: "/zh/pandas/mei-xiang", buttonName: /^收藏/, pressedButtonName: /^取消收藏/ },
  { locale: "en", path: "/en/pandas/mei-xiang", buttonName: /^Favorite /, pressedButtonName: /^Remove .* from favorites$/ },
]) {
  test(`${locale} profile Favorite is keyboard operable and remains accessible`, async ({ page }, testInfo) => {
    test.skip(!engagementEnabled, "The deployed Web build intentionally disables Engagement UI.");
    await page.route("**/api/identity/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accountId: "11111111-1111-1111-1111-111111111111", aal: "aal1", capabilities: [] }),
      });
    });
    await page.route("**/api/engagement/favorites", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"items":[]}' });
    });
    await page.route("**/api/engagement/favorites/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pandaId: "stable-panda-mei-xiang", favoritedAt: "2026-07-29T00:00:00Z" }),
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

test("bilingual Home tolerates a simulated 200-percent text-only resize", async ({ page }) => {
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

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    // Scrollers clip horizontally by design; their off-screen children do not overflow the page.
    const overflowing = await page.locator("*").evaluateAll((elements) => elements
      .filter((element) => {
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX)) return false;
        }
        return true;
      })
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
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("panda map dots open a place card from the keyboard", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/map");
  await page.waitForLoadState("networkidle");
  const dot = page.getByTestId("panda-world-map").getByRole("link", { name: /^Zoo Atlanta, Smithsonian's National Zoo/ });
  await dot.focus();
  await page.keyboard.press("Enter");
  const card = page.getByRole("dialog");
  await expect(card.getByRole("link", { name: /Smithsonian's National Zoo/ })).toHaveAttribute("href", "/en/institutions/smithsonian-national-zoo");
  await expect(card.getByRole("link", { name: /Zoo Atlanta/ })).toHaveAttribute("href", "/en/places/zoo-atlanta");
  await scanForWcagViolations(page, testInfo, "axe-mobile-panda-map-card");
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
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
    "/zh/map",
    "/en/map",
    "/zh/families?view=lineage&focus=mei-xiang",
    "/en/families?view=lineage&focus=bao-li&descendants=1",
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
