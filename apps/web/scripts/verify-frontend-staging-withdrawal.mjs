import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const TARGET_MEDIA_ID = "media-ri-ri-03e20f3f6a0e2db3";
const TARGET_SLUG = "ri-ri";
const UNRELATED_SLUG = "shin-shin";

function parseArgs(argv) {
  const options = { baseUrl: null, mode: null, phase: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!["--base-url", "--mode", "--phase", "--output"].includes(key)) {
      throw new Error(`Unknown argument ${key}.`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${key} requires a value.`);
    index += 1;
    if (key === "--base-url") options.baseUrl = value.replace(/\/$/, "");
    if (key === "--mode") options.mode = value;
    if (key === "--phase") options.phase = value;
    if (key === "--output") options.output = value;
  }
  if (!options.baseUrl || !/^https:\/\/panda-atlas-web-staging\.[a-z0-9-]+\.workers\.dev$/i.test(options.baseUrl)) {
    throw new Error("--base-url must target panda-atlas-web-staging on workers.dev.");
  }
  if (!["baseline", "withdrawn"].includes(options.mode)) throw new Error("--mode must be baseline or withdrawn.");
  if (!options.phase || !options.output) throw new Error("--phase and --output are required.");
  return options;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function navigate(page, url) {
  const response = await page.goto(url, { waitUntil: "networkidle" });
  requireCondition(response, `Navigation returned no response for ${url}.`);
  return { status: response.status(), body: await page.content() };
}

async function verifyLocalizedTarget(page, baseUrl, locale, mode) {
  const url = `${baseUrl}/${locale}/atlas/${TARGET_SLUG}`;
  const result = await navigate(page, url);
  if (mode === "baseline") {
    requireCondition(result.status === 200, `${locale} Ri Ri baseline expected 200; got ${result.status}.`);
    requireCondition(result.body.includes(TARGET_MEDIA_ID), `${locale} Ri Ri baseline lost reviewed media.`);
    requireCondition(result.body.includes(locale === "zh" ? "力力" : "Ri Ri"), `${locale} Ri Ri baseline lost the reviewed name.`);
    requireCondition(
      result.body.includes(locale === "zh" ? "力力在上野动物园" : "Ri Ri at Ueno Zoo"),
      `${locale} Ri Ri baseline lost reviewed alt text.`,
    );
    requireCondition(
      result.body.includes("EleniXDD / Wikimedia Commons"),
      `${locale} Ri Ri baseline lost reviewed credit.`,
    );
  } else {
    requireCondition(result.status === 404, `${locale} Ri Ri withdrawn profile expected 404; got ${result.status}.`);
    requireCondition(!result.body.includes(TARGET_MEDIA_ID), `${locale} withdrawn HTML leaked Ri Ri media.`);
  }
  return { locale, status: result.status, url };
}

async function verifyLegacyTarget(page, baseUrl, mode) {
  const result = await navigate(page, `${baseUrl}/atlas/${TARGET_SLUG}`);
  const expectedStatus = mode === "baseline" ? 200 : 404;
  requireCondition(
    result.status === expectedStatus,
    `Legacy Ri Ri entry expected ${expectedStatus}; got ${result.status}.`,
  );
  requireCondition(
    mode === "baseline" ? result.body.includes(TARGET_MEDIA_ID) : !result.body.includes(TARGET_MEDIA_ID),
    "Legacy Ri Ri entry media state drifted.",
  );
  return { status: result.status, url: `${baseUrl}/atlas/${TARGET_SLUG}` };
}

async function verifyUnrelated(page, baseUrl, locale) {
  const url = `${baseUrl}/${locale}/atlas/${UNRELATED_SLUG}`;
  const result = await navigate(page, url);
  requireCondition(result.status === 200, `${locale} Shin Shin expected 200; got ${result.status}.`);
  requireCondition(result.body.includes("media-shin-shin-6b36624de9829665"), `${locale} Shin Shin lost reviewed media.`);
  requireCondition(result.body.includes(locale === "zh" ? "真真" : "Shin Shin"), `${locale} Shin Shin lost the reviewed name.`);
  requireCondition(
    result.body.includes(locale === "zh" ? "真真在上野动物园吃竹子" : "Shin Shin eating bamboo at Ueno Zoo"),
    `${locale} Shin Shin lost reviewed alt text.`,
  );
  requireCondition(
    result.body.includes("EleniXDD / Wikimedia Commons"),
    `${locale} Shin Shin lost reviewed credit.`,
  );
  return { locale, status: result.status, url };
}

async function verifyDiscovery(page, baseUrl, mode) {
  const routes = [
    "/zh",
    "/en",
    "/zh/atlas",
    "/en/atlas",
    "/zh/lineage",
    "/en/lineage",
    "/zh/map",
    "/en/map",
    "/zh/my-pandas",
    "/en/my-pandas",
  ];
  const evidence = [];
  for (const route of routes) {
    const result = await navigate(page, `${baseUrl}${route}`);
    requireCondition(result.status === 200, `${route} expected 200; got ${result.status}.`);
    if (mode === "withdrawn") {
      requireCondition(!result.body.includes(`atlas/${TARGET_SLUG}`), `${route} retained a Ri Ri discovery link.`);
      requireCondition(!result.body.includes(TARGET_MEDIA_ID), `${route} leaked Ri Ri media.`);
    }
    evidence.push({ route, status: result.status });
  }
  return evidence;
}

async function verifyKeyboardAndViewport(page, baseUrl) {
  await page.setViewportSize({ width: 320, height: 720 });
  const result = await navigate(page, `${baseUrl}/zh/atlas/${UNRELATED_SLUG}`);
  requireCondition(result.status === 200, "320 px Shin Shin page did not return 200.");
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  requireCondition(dimensions.scrollWidth <= dimensions.clientWidth + 1, "320 px profile has horizontal overflow.");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? null,
    text: document.activeElement?.textContent?.trim().slice(0, 120) ?? null,
  }));
  requireCondition(focused.tag && focused.tag !== "BODY", "Keyboard navigation did not move focus.");
  return { dimensions, focused };
}

async function verifyNoJavaScript(browser, baseUrl, mode) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const target = await navigate(page, `${baseUrl}/en/atlas/${TARGET_SLUG}`);
    const unrelated = await navigate(page, `${baseUrl}/en/atlas/${UNRELATED_SLUG}`);
    requireCondition(target.status === (mode === "baseline" ? 200 : 404), "No-JavaScript Ri Ri status drifted.");
    requireCondition(unrelated.status === 200, "No-JavaScript Shin Shin status drifted.");
    requireCondition(!target.body.includes("__next_error__") || target.status === 404, "No-JavaScript page exposed a framework failure.");
    return { targetStatus: target.status, unrelatedStatus: unrelated.status };
  } finally {
    await context.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const requests = [];
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  context.on("request", (request) => requests.push(request.url()));
  const report = {
    schema_version: 1,
    outcome: "failed",
    mode: options.mode,
    phase: options.phase,
    baseUrl: options.baseUrl,
    started_at: new Date().toISOString(),
  };
  try {
    const page = await context.newPage();
    const localizedTarget = [];
    const unrelated = [];
    for (const locale of ["zh", "en"]) {
      localizedTarget.push(await verifyLocalizedTarget(page, options.baseUrl, locale, options.mode));
      unrelated.push(await verifyUnrelated(page, options.baseUrl, locale));
    }
    const legacyTarget = await verifyLegacyTarget(page, options.baseUrl, options.mode);
    const discovery = await verifyDiscovery(page, options.baseUrl, options.mode);
    const responsive = await verifyKeyboardAndViewport(page, options.baseUrl);
    const noJavaScript = await verifyNoJavaScript(browser, options.baseUrl, options.mode);
    await page.screenshot({
      path: path.join(options.output, `${options.phase}-${options.mode}-320.png`),
      fullPage: true,
    });
    if (options.mode === "withdrawn") {
      requireCondition(
        requests.every((url) => !url.includes(TARGET_MEDIA_ID)),
        "Withdrawn browser session requested Ri Ri media.",
      );
    }
    report.outcome = "passed";
    report.localizedTarget = localizedTarget;
    report.legacyTarget = legacyTarget;
    report.unrelated = unrelated;
    report.discovery = discovery;
    report.responsive = responsive;
    report.noJavaScript = noJavaScript;
    report.requests = requests;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    report.finished_at = new Date().toISOString();
    const tracePath = path.join(options.output, `${options.phase}-${options.mode}-trace.zip`);
    await context.tracing.stop({ path: tracePath });
    await context.close();
    await browser.close();
    writeFileSync(
      path.join(options.output, `${options.phase}-${options.mode}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
