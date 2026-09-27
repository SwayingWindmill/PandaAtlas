import { expect, test } from "@playwright/test";

test("fan V8 prototype renders the panda fan home", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(String(error)));

  await page.goto("/zh/prototype/fan-v08", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  await expect(page.getByTestId("fan-v08-prototype")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "认识每一只熊猫" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "继续探索熊猫世界" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近有什么新鲜事？" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "从美香开始，认识这一家" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "去哪里认识熊猫？" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "把喜欢的熊猫留在身边" })).toBeVisible();

  await page.getByRole("button", { name: "搜索" }).click();
  const searchDialog = page.locator('[data-slot="dialog-content"]');
  await expect(searchDialog).toBeVisible();
  await expect(searchDialog.getByText("小奇迹", { exact: true })).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test("fan V8 home remains usable at the narrow viewport floor", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/zh/prototype/fan-v08", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const metrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    headerHeight: document.querySelector("header")?.getBoundingClientRect().height ?? 0,
    firstSectionTop: document.querySelector("main section")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.headerHeight).toBeLessThanOrEqual(120);
  expect(metrics.firstSectionTop).toBeLessThanOrEqual(80);

  await page.getByRole("button", { name: "打开导航" }).click();
  const mobileSheet = page.locator('[data-slot="sheet-content"]');
  await expect(mobileSheet).toBeVisible();
  await expect(mobileSheet.getByText("浏览吱熊猫", { exact: true })).toBeVisible();
  await expect(mobileSheet.getByRole("link", { name: "家族", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/en/prototype/fan-v08", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1, name: "Meet every panda" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explore the panda world" })).toBeVisible();
});

test("fan V8 panda directory renders the editorial discovery flow", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("fan-v08-directory")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "熊猫图鉴" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "按名字搜索熊猫" })).toBeVisible();
  await expect(page.getByRole("button", { name: "有照片" })).toBeVisible();
  await expect(page.getByTestId("fan-v08-directory-list")).toBeVisible();

  const researchCount = page.getByTestId("fan-v08-research-count");
  if (await researchCount.count()) {
    await expect(researchCount).toContainText(/\d{4}/);
    const researchTotal = Number((await researchCount.innerText()).replace(/\D/g, ""));
    expect(researchTotal).toBeGreaterThan(1000);
    await expect(page.getByRole("button", { name: /继续显示 60 只/ })).toContainText(`60 / ${researchTotal}`);

    const search = page.getByRole("searchbox", { name: "按名字搜索熊猫" });
    await search.fill("阿旭");
    await expect(page.getByText("阿旭", { exact: true })).toBeVisible();
    await expect(page.getByText("1 只", { exact: true })).toBeVisible();
  }
});

test("fan V8 directory treats non-photographic research media as no-photo", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas", { waitUntil: "domcontentloaded" });

  const search = page.getByRole("searchbox", { name: "按名字搜索熊猫" });
  await search.fill("卧龙白色大熊猫");

  const row = page.getByTestId("fan-v08-directory-list").locator("a").filter({ hasText: "卧龙白色大熊猫" }).first();
  await expect(row).toBeVisible();
  await expect(row.getByLabel("卧龙白色大熊猫暂无确认个体照片")).toBeVisible();
  await expect(row.locator("img")).toHaveCount(0);

  await page.getByRole("button", { name: "有照片" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByText("0 只", { exact: true })).toBeVisible();
});

test("fan V8 panda portrait opens the redesigned detail experience", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas", { waitUntil: "domcontentloaded" });
  const search = page.getByRole("searchbox", { name: "按名字搜索熊猫" });
  await search.fill("思缘");

  const pandaLink = page.locator('a[href="/zh/prototype/fan-v08/pandas/si-yuan-qiyuan-offspring-2004"]');
  await expect(pandaLink).toBeVisible();
  await page.evaluate(() => {
    const samples: Array<{ left: number; top: number; width: number; height: number }> = [];
    (window as Window & { __pandaTransitionRects?: typeof samples }).__pandaTransitionRects = samples;
    const startedAt = performance.now();
    const sample = () => {
      const node = document.querySelector<HTMLElement>("[data-panda-transition-overlay='true']");
      if (node) {
        const rect = node.getBoundingClientRect();
        samples.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      }
      if (performance.now() - startedAt < 1500) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await pandaLink.click({ noWaitAfter: true });
  const overlay = page.locator("[data-panda-transition-overlay='true']");
  await expect(overlay).toBeVisible({ timeout: 300 });
  const initialBox = await overlay.boundingBox();
  expect(initialBox).not.toBeNull();
  await expect.poll(async () => (await overlay.boundingBox())?.width ?? 0, { timeout: 700 })
    .toBeGreaterThan((initialBox?.width ?? 0) + 5);

  await expect(page).toHaveURL(/\/zh\/prototype\/fan-v08\/pandas\/si-yuan-qiyuan-offspring-2004/);
  await expect(page.getByTestId("fan-v08-panda-detail")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "思缘" })).toBeVisible();
  await expect(page.locator("[data-panda-detail-hero] img")).toBeVisible();

  await page.waitForTimeout(1100);
  const transitionGeometry = await page.evaluate(() => {
    const samples = (window as Window & { __pandaTransitionRects?: Array<{ left: number; top: number; width: number; height: number }> }).__pandaTransitionRects ?? [];
    const hero = document.querySelector<HTMLElement>("[data-panda-detail-hero]");
    const heroRect = hero?.getBoundingClientRect();
    return {
      last: samples.at(-1) ?? null,
      hero: heroRect ? { left: heroRect.left, top: heroRect.top, width: heroRect.width, height: heroRect.height } : null,
    };
  });
  expect(transitionGeometry.last).not.toBeNull();
  expect(transitionGeometry.hero).not.toBeNull();
  expect(Math.abs(transitionGeometry.last!.left - transitionGeometry.hero!.left)).toBeLessThan(2);
  expect(Math.abs(transitionGeometry.last!.top - transitionGeometry.hero!.top)).toBeLessThan(2);
  expect(Math.abs(transitionGeometry.last!.width - transitionGeometry.hero!.width)).toBeLessThan(2);
  expect(Math.abs(transitionGeometry.last!.height - transitionGeometry.hero!.height)).toBeLessThan(2);

  await expect(page.getByRole("heading", { level: 2, name: "关于思缘", exact: true })).toBeVisible();
  await expect(page.locator("#overview article > p").first()).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: "#593" })).toBeVisible();
  await expect(page.getByText(/白手套妹妹/).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "关于它的几个事实" })).toBeVisible();
  await expect(page.locator("#panda-quick-facts")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "思缘的一生" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "思缘的家人" })).toBeVisible();
  const firstLifeEvent = page.locator('button[data-life-event-index="0"]');
  const secondLifeEvent = page.locator('button[data-life-event-index="1"]');
  await expect(firstLifeEvent).toHaveAttribute("aria-pressed", "true");

  if (await secondLifeEvent.count()) {
    await secondLifeEvent.click();
    await expect(secondLifeEvent).toHaveAttribute("aria-pressed", "true");
    await expect(firstLifeEvent).toHaveAttribute("aria-pressed", "false");
  }

  const galleryButton = page.getByRole("button", { name: "打开思缘的照片" }).first();
  if (await galleryButton.count()) {
    await galleryButton.click();
    await expect(page.locator(".yarl__root")).toBeVisible();
    await page.keyboard.press("Escape");
  }
});

test("fan V8 wild panda detail exposes rescue and release history", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas/sheng-lin-no1-wild-release", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("fan-v08-panda-detail")).toBeVisible();
  await expect(page.locator("#wild-story")).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "救护、放归与野外经历" })).toBeVisible();
  await expect(page.locator("#timeline button[data-life-event-index]").first()).toBeVisible();
});

test("fan V8 detail keeps acquisition evidence out of fan-facing copy", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas/xiao-xiao", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("fan-v08-panda-detail")).toBeVisible();
  await expect(page.getByText("入住雅安基地接受隔离检疫", { exact: true })).toBeVisible();
  await expect(page.getByText("上野动物园首对大熊猫双胞胎", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Commons 文件元数据");
  await expect(page.locator("body")).not.toContainText("该媒体页明确");
  await expect(page.locator("body")).not.toContainText("来源特定报告保留");
  await expect(page.locator("body")).not.toContainText("新华社报道晓晓");
});

test("fan V8 overview localizes family names and keeps wild classification evidence private", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas/xiao-xiao", { waitUntil: "domcontentloaded" });
  await expect(page.locator('#profile-overview [data-kind="family"] dd')).toHaveText("父亲：力力；母亲：欣欣；妹妹：蕾蕾");
  await expect(page.locator('#family small')).toHaveText(["父亲", "母亲", "妹妹"]);

  await page.goto("/zh/prototype/fan-v08/pandas/si-yuan-qiyuan-offspring-2004", { waitUntil: "domcontentloaded" });
  const siYuanFamily = page.locator('#profile-overview [data-kind="family"] dd');
  await expect(siYuanFamily).toContainText("儿子：思筠筠、思念、思一");
  await expect(siYuanFamily).toContainText("父亲：师师");
  await expect(siYuanFamily).toContainText("母亲：奇缘");
  await expect(siYuanFamily).not.toContainText("父母：");
  await expect(siYuanFamily).not.toContainText("子女：");

  await page.goto("/zh/prototype/fan-v08/pandas/wolong-white-panda-tracked-2019", { waitUntil: "domcontentloaded" });
  await expect(page.locator('#profile-overview [data-kind="identity"] dd')).toHaveText("野生个体");
  await expect(page.locator('#profile-overview [data-kind="place"] dd')).toContainText("野外监测区域（不公开精确位置）");
  await expect(page.getByRole("img", { name: "卧龙白色大熊猫 · 暂无确认个体照片" })).toBeVisible();
  await expect(page.locator("[data-panda-detail-hero] img")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("建立为未命名野外独立Subject");
});

test("fan V8 About reads like a concise panda introduction instead of a profile dump", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/pandas/xiao-xiao", { waitUntil: "domcontentloaded" });
  const xiaoAbout = page.locator("#overview article");
  expect(await xiaoAbout.locator(":scope > p").count()).toBe(4);
  await expect(xiaoAbout.locator(":scope > p").first()).toContainText("力力和欣欣的儿子");
  await expect(xiaoAbout.locator(":scope > p").first()).toContainText("晓晓和蕾蕾是双胞胎");
  await expect(xiaoAbout.locator(":scope > p").first()).toContainText("蕾蕾是妹妹");
  await expect(xiaoAbout.locator(":scope > p").nth(1)).toContainText("上野动物园首次出生的大熊猫双胞胎");
  await expect(xiaoAbout.locator(":scope > p").nth(1)).toContainText("名字寓意");
  await expect(xiaoAbout.locator(":scope > p").nth(2)).toContainText("健康管理训练");
  await expect(xiaoAbout.locator(":scope > p").nth(2)).toContainText("血压测量、采血和X光定位");
  await expect(xiaoAbout.locator(":scope > p").nth(3)).toContainText("最后一次在上野动物园与公众见面");
  await expect(xiaoAbout.locator(":scope > p").nth(3)).toContainText("离开上野，第二天抵达雅安基地");
  await expect(xiaoAbout.locator(":scope > p").nth(3)).toContainText("逐渐适应");
  await expect(xiaoAbout).not.toContainText(/构成.+故事|值得被记住|历史的一部分|具有.{0,8}意义/u);

  const xiaoLifeStories = page.locator("#life-stories");
  if (await xiaoLifeStories.count()) {
    await expect(xiaoLifeStories).not.toContainText("上野动物园首次出生的大熊猫双胞胎");
    await expect(xiaoLifeStories).not.toContainText("健康管理训练");
  }
  await expect(page.locator("#timeline")).toBeVisible();
  await expect(page.locator("#footprint")).toContainText("离开上野");
  await expect(page.locator("#recent-moments")).toBeVisible();

  await page.goto("/zh/prototype/fan-v08/pandas/si-yuan-qiyuan-offspring-2004", { waitUntil: "domcontentloaded" });
  const siYuanAbout = page.locator("#overview article");
  expect(await siYuanAbout.locator(":scope > p").count()).toBeGreaterThanOrEqual(3);
  await expect(siYuanAbout.locator(":scope > p").first()).toContainText("师师和奇缘的女儿");
  await expect(siYuanAbout).toContainText("白手套妹妹");
  await expect(siYuanAbout).toContainText("性格温和");

  await page.goto("/zh/prototype/fan-v08/pandas/wolong-white-panda-tracked-2019", { waitUntil: "domcontentloaded" });
  const wildAbout = page.locator("#overview article");
  await expect(wildAbout).not.toContainText("该野生个体");
  await expect(wildAbout).not.toContainText("卧龙白色大熊猫是一只大熊猫");
  await expect(wildAbout).toContainText("毛发通体白色");

  await page.goto("/zh/prototype/fan-v08/pandas/xi-xi-chongqing-296", { waitUntil: "domcontentloaded" });
  const sparseAbout = page.locator("#overview article");
  await expect(sparseAbout).toContainText("父亲是强强，母亲是Nan Nan");
  await expect(sparseAbout).toContainText("现有资料没有完整留下它的出生日期和后续经历");
});

test("fan V8 hero profile overlays the photo and gallery follows the hero", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/zh/prototype/fan-v08/pandas/xiao-xiao", { waitUntil: "domcontentloaded" });

  const header = page.locator("header").first();
  const hero = page.locator("[data-panda-detail-hero]");
  const profile = page.locator("#profile-overview");
  const trigger = page.locator('button[aria-controls="profile-overview"]');
  const gallery = page.locator('section[aria-label="晓晓更多照片"]');

  await expect(hero).toBeVisible();
  await expect(profile).toHaveAttribute("data-profile-open", "true", { timeout: 2500 });
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(gallery).toBeVisible();

  const profileBackground = await profile.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(profileBackground).toBe("rgba(6, 47, 49, 0.78)");

  const headerBox = await header.boundingBox();
  const heroBefore = await hero.boundingBox();
  const profileBefore = await profile.boundingBox();
  const galleryBox = await gallery.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(heroBefore).not.toBeNull();
  expect(profileBefore).not.toBeNull();
  expect(galleryBox).not.toBeNull();
  expect(heroBefore!.y).toBeLessThanOrEqual(headerBox!.y);
  expect(headerBox!.y + headerBox!.height).toBeGreaterThan(heroBefore!.y);
  expect(heroBefore!.height).toBeGreaterThanOrEqual(1070);
  const heroVisual = await hero.evaluate((element) => {
    const image = element.querySelector("img")!;
    const imageStyle = getComputedStyle(image);
    const matrix = new DOMMatrix(imageStyle.transform);
    return {
      gradientHeight: Number.parseFloat(getComputedStyle(element, "::after").height),
      topFadeHeight: Number.parseFloat(getComputedStyle(element, "::before").height),
      imageTransform: imageStyle.transform,
      imageTranslateY: matrix.m42,
    };
  });
  expect(heroVisual.gradientHeight).toBeGreaterThanOrEqual(330);
  expect(heroVisual.topFadeHeight).toBeGreaterThanOrEqual(120);
  expect(heroVisual.imageTransform).not.toBe("none");
  expect(heroVisual.imageTranslateY).toBeGreaterThan(20);
  expect(profileBefore!.x).toBeGreaterThan(heroBefore!.x);
  expect(profileBefore!.x).toBeLessThan(heroBefore!.x + heroBefore!.width);
  expect(galleryBox!.y).toBeGreaterThanOrEqual(heroBefore!.y + heroBefore!.height - 2);

  await trigger.click();
  await expect(profile).toHaveAttribute("data-profile-open", "false");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(950);

  const heroAfter = await hero.boundingBox();
  const profileAfter = await profile.boundingBox();
  expect(heroAfter).not.toBeNull();
  expect(profileAfter).not.toBeNull();
  expect(Math.abs(heroAfter!.width - heroBefore!.width)).toBeLessThan(1);
  expect(Math.abs(heroAfter!.height - heroBefore!.height)).toBeLessThan(1);
  expect(profileAfter!.x).toBeGreaterThanOrEqual(1439);
});

test("fan V8 UI lab compares adopted public components", async ({ page }) => {
  await page.goto("/zh/prototype/fan-v08/ui-lab", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("fan-v08-ui-lab")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "哪些组件真的适合熊猫网站？" })).toBeVisible();

  const familyTab = page.getByRole("tab", { name: "家族", exact: true }).first();
  await familyTab.click();
  await expect(familyTab).toHaveAttribute("aria-selected", "true");

  const dailyDisclosure = page.getByRole("button", { name: "性格与日常", exact: true }).first();
  await dailyDisclosure.click();
  await expect(page.getByText("现有采集记录显示，思缘性格温和、采食慢条斯理。", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "打开熊猫照片" }).first().click();
  await expect(page.locator(".yarl__root")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".yarl__root")).toHaveCount(0);

  await page.getByRole("button", { name: "打开移动资料目录" }).click();
  await expect(page.getByText("思缘 · 快速目录", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();

  await page.setViewportSize({ width: 320, height: 760 });
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
});

test("fan V8 sparse panda detail keeps an intentional no-photo state on compact screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/zh/prototype/fan-v08/pandas", { waitUntil: "domcontentloaded" });

  const search = page.getByRole("searchbox", { name: "按名字搜索熊猫" });
  await search.fill("阿旭");
  const pandaLink = page.getByTestId("fan-v08-directory-list").locator("a").filter({ hasText: "阿旭" }).first();
  await expect(pandaLink).toBeVisible();
  await pandaLink.click();

  await expect(page.getByTestId("fan-v08-panda-detail")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "阿旭" })).toBeVisible();
  await expect(page.getByLabel("阿旭暂无确认个体照片")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "关于阿旭" })).toBeVisible();
  await expect(page.locator("#overview article > p").first()).toBeVisible();
  await expect(page.locator("[data-panda-transition-overlay='true']")).toHaveCount(0);

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
});
