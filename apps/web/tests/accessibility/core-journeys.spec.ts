import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const journey of [
  { name: "Chinese trusted profile", path: "/zh/atlas/mei-xiang" },
  { name: "English trusted profile", path: "/en/atlas/mei-xiang" },
  { name: "distribution map and text alternative", path: "/global-distribution" },
  {
    name: "lineage explorer and structured relationship content",
    path: "/lineage?focus=2939c16f-1938-5629-928c-b36b1d5cd6ed",
  },
]) {
  test(`${journey.name} has no automated WCAG A/AA violations`, async ({ page }, testInfo) => {
    await page.goto(journey.path);
    await expect(page.locator("main").first()).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    await testInfo.attach("axe-results", {
      body: Buffer.from(JSON.stringify(results, null, 2)),
      contentType: "application/json",
    });
    testInfo.annotations.push({
      type: "axe-incomplete",
      description: String(results.incomplete.length),
    });

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("bilingual profile content declares its language", async ({ page }) => {
  for (const { path, language } of [
    { path: "/zh/atlas/mei-xiang", language: "zh-CN" },
    { path: "/en/atlas/mei-xiang", language: "en" },
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("trusted-panda-profile")).toHaveAttribute("lang", language);
  }
});

test("reduced-motion removes nonessential animation from core journeys", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const path of [
    "/zh/atlas/mei-xiang",
    "/global-distribution",
    "/lineage?focus=2939c16f-1938-5629-928c-b36b1d5cd6ed",
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
