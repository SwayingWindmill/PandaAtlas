import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { openedTabs, recordOpenedTabs } from "./support/opened-tabs.ts";
import { test } from "./support/test.ts";

test("a profile states sex, birth, home and parents, and lists the places it has lived", async ({ app, screen }) => {
  const { panda, zoo } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
  // The facts sit in the name line and the stat tiles; each tile reads as one sentence.
  await expect(screen.getByLabel(/雌性$/)).toBeVisible();
  await expect(screen.getByLabel("生日，7.20，已确认")).toBeVisible();
  await expect(screen.getByRole("link", "所在地，成都")).toBeVisible();
  await expect(screen.getByRole("button", `父母，妈妈选项丙${runSuffix()}，爸爸选项丁${runSuffix()}`)).toBeVisible();

  // The places it has lived are on its 时间线, under 动态.
  await screen.getByRole("radio", "动态").tap();
  await screen.getByRole("button", "时间线").tap();
  await expect(screen.getByRole("heading", `${panda.name}的时间线`)).toBeVisible();
  await expect(screen.getByText(/住过 1 个地方/)).toBeVisible();
  await expect(screen.getByText(`住进${zoo.facility}`)).toBeVisible();
});

test("a sparse profile says what is unknown and asks fans to tell us", async ({ app, screen }) => {
  const { panda, notice } = fixture();
  // 选项乙 has no photo, no recorded sex, birth or home, and no life events.
  await app.open(`/pandas/${notice.slug}`);
  await expect(screen.getByRole("heading", notice.name)).toBeVisible();
  await expect(screen.getByText("暂无照片")).toBeVisible();
  await expect(screen.getByLabel("生日，未记录")).toBeVisible();
  await screen.getByRole("radio", "动态").tap();
  await screen.getByRole("button", "知道它的经历？告诉我们").tap();
  await expect(screen.getByText("登录后才能纠错", { exact: false })).toBeVisible();

  // The fixture panda's events are empty too, but it has a photo.
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
  await expect(screen.getByText("暂无照片")).toHaveCount(0);
});

test("找熊猫's area chips narrow the list to pandas living there", async ({ app, screen }) => {
  const { panda, notice } = fixture();
  await app.open("/find");
  // The fixture panda lives at the fixture zoo, which is in Chengdu.
  await screen.getByRole("button", "成都").tap();
  await screen.getByLabel("搜索熊猫").fill(runSuffix());
  await expect(screen.getByRole("button", new RegExp(`^${panda.name}`))).toBeVisible();
  await expect(screen.getByRole("button", new RegExp(`^${notice.name}`))).toHaveCount(0);
  await screen.getByRole("button", "全部").tap();
  await expect(screen.getByRole("button", new RegExp(`^${notice.name}`))).toBeVisible();
});

test("profile keeps Segmented vertically stable across tabs", async ({ app, screen, browser }) => {
  const { panda } = fixture();

  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("radio", { name: "概况", checked: true })).toBeVisible();
  await expect(screen.getByLabel("生日，7.20，已确认")).toBeVisible();

  const segmentedTop = () =>
    browser.evaluate(
      () => document.querySelector('[role="radiogroup"][aria-label="资料分区"]')?.getBoundingClientRect().top ?? null,
    );

  await screen.getByRole("radio", "家族").tap();
  await expect(screen.getByLabel("生日，7.20，已确认")).toHaveCount(0);
  const familyTop = await segmentedTop();
  expect(familyTop).not.toBeNull();

  await screen.getByRole("radio", "动态").tap();
  await expect(screen.getByLabel("生日，7.20，已确认")).toHaveCount(0);
  const eventsTop = await segmentedTop();
  expect(eventsTop).not.toBeNull();
  expect(Math.abs(eventsTop! - familyTop!)).toBeLessThanOrEqual(1);

  await screen.getByRole("radio", "概况").tap();
  await expect(screen.getByLabel("生日，7.20，已确认")).toBeVisible();
  const overviewTop = await segmentedTop();
  expect(overviewTop).not.toBeNull();
  expect(Math.abs(overviewTop! - familyTop!)).toBeLessThanOrEqual(1);
});

test("venue exposes clickable live cam link and resident filter tabs", async ({ app, screen, browser }) => {
  const { notice, zoo } = fixture();

  await recordOpenedTabs(browser);
  await browser.route(new RegExp(`/api/v2/institutions/${zoo.slug}$`), async (route) => {
    const upstream = await route.fetch();
    const headers = Object.fromEntries(
      Object.entries(upstream.headers).filter(([name]) => !["content-length", "content-encoding"].includes(name.toLowerCase())),
    );
    const body = (await upstream.json()) as {
      institution: { profile?: Record<string, unknown> | null };
      residents: {
        pandaId: string;
        canonicalSlug: string;
        legacySlugs: string[];
        names: { languageTag: string; nameKind: string; value: string; isPrimary: boolean }[];
        facts: unknown[];
        hasFullBleedCover?: boolean;
      }[];
    };
    body.institution.profile = { ...(body.institution.profile ?? {}), liveCamUrl: "https://example.test/live" };
    if (body.residents.length < 2) {
      body.residents.push({
        pandaId: notice.id,
        canonicalSlug: notice.slug,
        legacySlugs: [],
        names: [{ languageTag: "zh-Hans", nameKind: "official", value: notice.name, isPrimary: true }],
        facts: [],
        hasFullBleedCover: false,
      });
    }
    await route.fulfill({ status: upstream.status, headers, body: JSON.stringify(body) });
  });

  await app.open(`/institutions/${zoo.slug}`);
  const liveLink = screen.getByRole("link", "看官方直播");
  await expect(liveLink).toBeVisible();
  await liveLink.tap();
  await expect.poll(async () => (await openedTabs(browser)).includes("https://example.test/live")).toBe(true);

  await screen.getByRole("radio", "熊猫").tap();
  await expect(screen.getByRole("tab", { name: /^全部 /, selected: true })).toBeVisible();
  const unseenTab = screen.getByRole("tab", /^未见过 /);
  await expect(unseenTab).toBeVisible();
  await unseenTab.tap();
  await expect(screen.getByRole("tab", { name: /^未见过 /, selected: true })).toBeVisible();
});
