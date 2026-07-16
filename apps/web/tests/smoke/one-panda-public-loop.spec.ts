import { expect, test } from "@playwright/test";

test("finds Mei Xiang by every reviewed public identity form", async ({ page }) => {
  for (const query of [
    "美香",
    "Mei Xiang",
    "Měixiāng",
    "Mei-Xiang",
    "meixiang",
    "smithsonian_history_key:mei-xiang",
  ]) {
    await page.goto(`/zh/atlas?q=${encodeURIComponent(query)}`);
    await expect(page.getByRole("heading", { name: "1 份已发布档案" }), query).toBeVisible();
    await expect(page.getByRole("link", { name: /美香.*Mei Xiang/ }), query).toHaveAttribute(
      "href",
      "/zh/atlas/mei-xiang",
    );
  }
});

test("serves bilingual canonical routes and permanently redirects legacy slugs", async ({ request }) => {
  const legacy = await request.get("/atlas/meixiang", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toContain("/zh/atlas/mei-xiang");

  const englishLegacy = await request.get("/en/atlas/meixiang", { maxRedirects: 0 });
  expect(englishLegacy.status()).toBe(308);
  expect(englishLegacy.headers().location).toContain("/en/atlas/mei-xiang");

  for (const path of ["/zh/atlas/mei-xiang", "/en/atlas/mei-xiang"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text()).toContain("Mei Xiang");
  }

  expect((await request.get("/en/atlas/tian-tian")).status()).toBe(200);
  const tianTianLegacy = await request.get("/en/atlas/tiantian", { maxRedirects: 0 });
  expect(tianTianLegacy.status()).toBe(308);
  expect(tianTianLegacy.headers().location).toContain("/en/atlas/tian-tian");
});

test("renders the reviewed identity, family, footprint, evidence, no-image, and revision loop", async ({ page }) => {
  await page.goto("/zh/atlas/mei-xiang");

  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /美香/ })).toBeVisible();
  await expect(page.getByText("稳定身份")).toBeVisible();
  await expect(page.getByText("完整档案").first()).toBeVisible();
  await expect(page.getByText("最后核实：2026-05-09").first()).toBeVisible();
  await expect(page.getByTestId("fact-life-status")).toContainText("存活");
  await expect(page.getByTestId("fact-life-status")).toContainText("分类值");
  await expect(page.getByTestId("fact-birth")).toContainText("结论状态：已确认");
  await expect(page.getByTestId("fact-birth")).toContainText("精度：日");
  for (const fact of ["fact-birth", "fact-sex", "fact-place"]) {
    await expect(page.getByTestId(fact)).toContainText("来源");
    await expect(page.getByTestId(fact).getByRole("link")).toHaveCount(1);
  }
  await expect(page.getByTestId("fact-parents")).toContainText("暂无已审核来源结论");
  await expect(page.getByTestId("lineage-text-view")).toContainText("小奇迹");
  await expect(page.getByTestId("footprint-text-view")).toContainText("史密森国家动物园");
  await expect(page.getByTestId("footprint-text-view")).toContainText("中国（国家级记录）");
  await expect(page.getByTestId("evidence-list").getByRole("link")).toHaveCount(2);
  await expect(page.getByTestId("media-empty-state")).toContainText("暂无可公开授权影像");
  await expect(page.getByTestId("revision-summary")).toContainText("2026.07.14.3");
  await expect(page.getByTestId("timeline-list")).toContainText("来源发布日期");
});

test("renders partial, tentative, facility, source-link-only, and revision states truthfully", async ({ page }) => {
  await page.goto("/zh/atlas/bei-bei");
  await expect(page.getByTestId("fact-place")).toContainText("中国大熊猫保护研究中心卧龙神树坪基地");
  await expect(page.getByText("当前时间线是已发布子集，不代表完整生平。")).toBeVisible();

  await page.goto("/zh/atlas/bao-li");
  const parentRelations = page.getByTestId("parent-relations");
  await expect(parentRelations).toContainText("An An");
  await expect(parentRelations).toContainText("暂定关系");
  await expect(parentRelations).toContainText("仅有关系依赖记录，暂无完整档案");
  await expect(parentRelations.getByRole("link", { name: "An An" })).toHaveCount(0);

  await page.goto("/zh/atlas/tian-tian");
  await expect(page.getByTestId("media-source-link-state")).toContainText("仅提供来源媒体链接");
  await expect(page.getByTestId("media-source-link-state").getByRole("link")).toHaveCount(1);
  await expect(page.getByTestId("revision-summary")).toContainText("版本标识可用，但当前语言的修订摘要尚未发布");
  await expect(page.getByTestId("evidence-list")).toContainText("可访问");
});

test("keeps favorites local-only and keyboard operable", async ({ page }) => {
  await page.goto("/zh/atlas/mei-xiang");

  const favorite = page.getByRole("button", { name: "收藏美香" });
  await expect(favorite).toBeEnabled();
  await favorite.focus();
  await page.keyboard.press("Enter");
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/仅保存在此浏览器/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("panda-atlas:saved-profiles"))).toContain("mei-xiang");
});

test("exposes the full reading loop through sequential keyboard navigation", async ({ page }) => {
  await page.goto("/zh/atlas/mei-xiang");
  const visited = new Set<string>();

  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press("Tab");
    const target = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return element?.getAttribute("href") ?? element?.getAttribute("aria-label") ?? "";
    });
    if (target) visited.add(target);
  }

  expect([...visited].some((target) => target.includes("#timeline"))).toBe(true);
  expect([...visited].some((target) => target.includes("/en/atlas/mei-xiang"))).toBe(true);
  expect([...visited].some((target) => target.includes("/zh/atlas/tai-shan"))).toBe(true);
  expect([...visited].some((target) => target.startsWith("http"))).toBe(true);
  expect(visited.has("收藏美香")).toBe(true);
});

test("keeps the server-rendered profile readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/zh/atlas/mei-xiang");

  await expect(page.getByRole("heading", { level: 1, name: /美香/ })).toBeVisible();
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await expect(page.getByTestId("footprint-text-view")).toBeVisible();
  await expect(page.getByTestId("evidence-list")).toBeVisible();
  await context.close();
});

test("reflows at the effective CSS viewport produced by 200-percent browser zoom", async ({ page }) => {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 640,
    height: 450,
    screenWidth: 1280,
    screenHeight: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.goto("/zh/atlas/mei-xiang");

  expect(await page.evaluate(() => screen.width / innerWidth)).toBe(2);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByTestId("footprint-text-view")).toBeVisible();
});

test("keeps the complete public loop usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh/atlas/mei-xiang");

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.getByTestId("identity-first-card")).toBeVisible();
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await expect(page.getByTestId("footprint-text-view")).toBeVisible();
  await expect(page.getByTestId("media-empty-state")).toBeVisible();
});

test("uses the trusted profile theme in dark color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en/atlas/mei-xiang");

  const colors = await page.getByTestId("identity-first-card").evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(colors.background).toBe("rgb(24, 33, 26)");
  expect(colors.color).toBe("rgb(237, 243, 238)");
});
