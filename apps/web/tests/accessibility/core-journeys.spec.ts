import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

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
  { name: "Chinese Atlas discovery", path: "/zh/atlas?status=alive&sort=name" },
  { name: "English Atlas discovery", path: "/en/atlas?status=alive&sort=name" },
  { name: "Chinese trusted profile", path: "/zh/atlas/mei-xiang" },
  { name: "English trusted profile", path: "/en/atlas/mei-xiang" },
  { name: "Chinese structured map journey", path: "/zh/map?mode=institutions&snapshot=2026.07.14.3" },
  { name: "English structured map journey", path: "/en/map?mode=wild&snapshot=2026.07.14.3" },
  {
    name: "Chinese structured lineage relationship content",
    path: "/zh/lineage?focus=mei-xiang",
  },
  {
    name: "English structured lineage relationship content",
    path: "/en/lineage?focus=bao-li&descendants=1",
  },
];

for (const journey of coreJourneys) {
  test(`${journey.name} has no automated WCAG A/AA violations`, async ({ page }, testInfo) => {
    await page.goto(journey.path);
    await expect(page.locator("main").first()).toBeVisible();

    await scanForWcagViolations(page, testInfo, "axe-desktop-initial");
  });

  test(`${journey.name} remains accessible at a mobile viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(journey.path);
    await expect(page.locator("main").first()).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await scanForWcagViolations(page, testInfo, "axe-mobile-initial");
  });
}

test("bilingual profile content declares its language", async ({ page }) => {
  for (const { path, language } of [
    { path: "/zh/atlas/mei-xiang", language: "zh-CN" },
    { path: "/en/atlas/mei-xiang", language: "en" },
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await expect(page.getByTestId("trusted-panda-profile")).toHaveAttribute("lang", language);
  }
});

for (const { locale, path, buttonName, pressedButtonName } of [
  { locale: "zh", path: "/zh/atlas/mei-xiang", buttonName: /^收藏/, pressedButtonName: /^取消收藏/ },
  { locale: "en", path: "/en/atlas/mei-xiang", buttonName: /^Save /, pressedButtonName: /^Remove / },
]) {
  test(`${locale} profile action is keyboard operable and remains accessible`, async ({ page }, testInfo) => {
    await page.addInitScript(() => localStorage.removeItem("panda-atlas:saved-profiles"));
    await page.goto(path);
    const favorite = page.getByRole("button", { name: buttonName });
    await expect(favorite).toBeEnabled();
    await favorite.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: pressedButtonName })).toHaveAttribute("aria-pressed", "true");
    await scanForWcagViolations(page, testInfo, `axe-keyboard-favorite-${locale}`);
  });
}

test("bilingual profiles tolerate a simulated 200-percent text-only resize", async ({ page }) => {
  for (const path of ["/zh/atlas/mei-xiang", "/en/atlas/mei-xiang"]) {
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

    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await expect(page.getByTestId("footprint-text-view")).toBeVisible();
  }
});

test("structured map filters remain keyboard operable and accessible", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/map?mode=institutions&snapshot=2026.07.14.3");
  const form = page.getByRole("form", { name: "Filter structured results" });
  await form.getByLabel("Panda, institution, or place").fill("Smithsonian");
  await form.getByLabel("Country scope").selectOption("US");
  await form.getByRole("button", { name: "Update results" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 3, name: "Smithsonian's National Zoo" })).toBeVisible();
  await scanForWcagViolations(page, testInfo, "axe-mobile-structured-map-filtered");
});

test("reduced-motion removes nonessential animation from core journeys", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const path of [
    "/zh/atlas?status=alive&sort=name",
    "/en/atlas?status=alive&sort=name",
    "/zh/atlas/mei-xiang",
    "/en/atlas/mei-xiang",
    "/zh/map?mode=institutions&snapshot=2026.07.14.3",
    "/en/map?mode=wild&snapshot=2026.07.14.3",
    "/zh/lineage?focus=mei-xiang",
    "/en/lineage?focus=bao-li&descendants=1",
  ]) {
    await page.goto(path);
    const movingElements = await page.locator("*").evaluateAll((elements) =>
      elements
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            animationDuration: style.animationDuration,
            animationIterationCount: style.animationIterationCount,
            transitionDuration: style.transitionDuration,
          };
        })
        .filter(({ animationDuration, animationIterationCount, transitionDuration }) => {
          const durations = `${animationDuration},${transitionDuration}`
            .split(",")
            .map((value) => Number.parseFloat(value) || 0);
          return Math.max(...durations) > 0.01 || animationIterationCount === "infinite";
        }),
    );

    expect(movingElements, `${path} retains motion under prefers-reduced-motion`).toEqual([]);
  }
});
