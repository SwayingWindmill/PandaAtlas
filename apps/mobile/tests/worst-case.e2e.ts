import type { Browser } from "@e2e-dev/web";
import { expect } from "e2e";

import { fixture } from "./support/fixture.ts";
import { test } from "./support/test.ts";
import { LONG_NAMES, LONG_VENUE, RESIDENT_COUNT, WORST_CASE_PATHS, worstCase } from "./support/worst-case.ts";

// The fixture's public reads, rewritten into the worst case production data allows (tests/support/worst-case.ts):
// unbounded names, missing birth dates and covers, a parent with 30+ cubs, a venue with 120 residents. Each
// journey checks the screen still fits the 390-wide viewport and keeps what a fan needs reachable.

const [, LONG_ZH] = LONG_NAMES[0]!;

async function serveWorstCase(browser: Browser) {
  await browser.route(WORST_CASE_PATHS, async (route) => {
    const upstream = await route.fetch();
    const headers = Object.fromEntries(
      Object.entries(upstream.headers).filter(([name]) => !["content-length", "content-encoding"].includes(name.toLowerCase())),
    );
    const body = upstream.status === 200 ? JSON.stringify(worstCase(new URL(route.request.url).pathname, await upstream.json())) : await upstream.text();
    await route.fulfill({ status: upstream.status, headers, body });
  });
}

/** Text that reaches past the viewport's right edge outside a horizontal scroller, which a fan cannot read. */
async function overflowing(browser: Browser): Promise<string[]> {
  return browser.evaluate(() => {
    const scrolls = (element: Element) => ["auto", "scroll", "hidden"].includes(getComputedStyle(element).overflowX);
    const out: string[] = [];
    for (const element of document.querySelectorAll("body *")) {
      if (element.children.length > 0 || !element.textContent?.trim()) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= window.innerWidth + 1) continue;
      let parent = element.parentElement;
      while (parent && !scrolls(parent)) parent = parent.parentElement;
      if (!parent) out.push(`${element.textContent.slice(0, 40)} → ${Math.round(rect.right)}`);
    }
    return out;
  });
}

test("找熊猫 lists worst-case names inside the screen", async ({ app, screen, browser }) => {
  await serveWorstCase(browser);
  await app.open("/find");
  await expect(screen.getByRole("button", { name: new RegExp(`^${LONG_ZH.replace(/[()/]/g, "\\$&")}`) }).first()).toBeVisible();
  expect(await overflowing(browser)).toEqual([]);
});

test("a profile with no birth date, eight aliases and 30+ cubs keeps its name and family on screen", async ({ app, screen, browser }) => {
  const { panda } = fixture();
  await serveWorstCase(browser);
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", LONG_ZH)).toBeVisible();
  expect(await overflowing(browser)).toEqual([]);

  await app.open(`/pandas/${panda.slug}/family`);
  await expect(screen.getByRole("heading", `${LONG_ZH}的家族`)).toBeVisible();
  expect(await overflowing(browser)).toEqual([]);
});

test("a venue with a long name and 120 residents previews a few faces and opens the rest from 全部", async ({ app, screen, browser }) => {
  const { zoo } = fixture();
  await serveWorstCase(browser);
  await app.open(`/institutions/${zoo.slug}`);
  await expect(screen.getByRole("heading", LONG_VENUE.nameZh)).toBeVisible();
  expect(await overflowing(browser)).toEqual([]);

  // The 住在这里 strip is the horizontal scroller holding the residents' faces.
  const faces = await browser.evaluate(() => {
    const title = [...document.querySelectorAll("body *")].find((element) => element.children.length === 0 && element.textContent === "住在这里");
    let section = title?.parentElement ?? null;
    while (section && !section.querySelector('[role="link"]')) section = section.parentElement;
    return section?.querySelectorAll('[role="link"]').length ?? 0;
  });
  expect(faces).toBeGreaterThan(0);
  expect(faces).toBeLessThanOrEqual(12);

  await screen.getByRole("button", "看全部熊猫").tap();
  await expect(screen.getByText(`住在这里的熊猫　${RESIDENT_COUNT} 只`)).toBeVisible();
});
