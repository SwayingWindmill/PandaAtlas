import { expect } from "e2e";

import { fixture, runSuffix } from "./support/fixture.ts";
import { openedTabs, recordOpenedTabs } from "./support/opened-tabs.ts";
import { test } from "./support/test.ts";

test("a profile states sex, birth, home, studbook and parents, and links directly to the timeline", async ({ app, screen }) => {
  const { panda, zoo } = fixture();
  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
  // The unified 3-column strip shows birthday (with birth year and age), current home, and studbook.
  await expect(screen.getByLabel(/雌性$/)).toBeVisible();
  await expect(screen.getByLabel(/^生日，7月20日，2020 年 .*已确认$/)).toBeVisible();
  await expect(screen.getByRole("link", /^现居，成都/)).toBeVisible();
  await expect(screen.getByLabel("谱系号，未记录")).toBeVisible();
  await expect(screen.getByRole("link", `妈妈，选项丙${runSuffix()}`)).toBeVisible();
  await expect(screen.getByRole("link", `爸爸，选项丁${runSuffix()}`)).toBeVisible();

  await screen.getByRole("link", "时间线").tap();
  await expect(screen.getByRole("heading", `${panda.name}的时间线`)).toBeVisible();
  await expect(screen.getByText(/住过 1 个地方/)).toBeVisible();
  await expect(screen.getByText(`住进${zoo.facility}`)).toBeVisible();
});

test("a sparse profile keeps missing metrics quiet and places correction at the footer", async ({ app, screen }) => {
  const { panda, notice } = fixture();
  // 选项乙 has no photo, no recorded sex, birth or home, and no life events.
  await app.open(`/pandas/${notice.slug}`);
  await expect(screen.getByRole("heading", notice.name)).toBeVisible();
  await expect(screen.getByRole("button", new RegExp(`查看${notice.name}的照片`))).toHaveCount(0);
  await expect(screen.getByLabel("生日，未记录")).toBeVisible();
  await expect(screen.getByLabel("现居，未记录")).toBeVisible();
  await expect(screen.getByLabel("谱系号，未记录")).toBeVisible();
  await screen.getByRole("button", "信息有遗漏？帮我们补充").tap();
  await expect(screen.getByText("登录后才能纠错", { exact: false })).toBeVisible();

  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByRole("heading", panda.name)).toBeVisible();
  await expect(screen.getByRole("button", `查看${panda.name}的照片，共 2 张`)).toBeVisible();
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

test("profile uses a single-scroll canvas without middle tabs and links directly to photos, tree and tools", async ({ app, screen, browser }) => {
  const { panda } = fixture();

  await app.open(`/pandas/${panda.slug}`);
  await expect(screen.getByLabel(/^生日，7月20日，2020 年 .*已确认$/)).toBeVisible();
  const segmentedCount = await browser.evaluate(
    () => document.querySelectorAll('[role="radiogroup"][aria-label="资料分区"]').length,
  );
  expect(segmentedCount).toBe(0);

  await expect(screen.getByRole("link", "全部 2 张")).toBeVisible();
  await expect(screen.getByRole("link", "家族树")).toBeVisible();
  await expect(screen.getByRole("link", "时间线")).toBeVisible();
  await expect(screen.getByRole("button", `生成${panda.name}的名片卡`)).toBeVisible();
  await expect(screen.getByRole("button", `查询${panda.name}的亲缘关系`)).toBeVisible();
  await expect(screen.getByRole("button", `和别的熊猫比一比${panda.name}`)).toBeVisible();
});

test("venue exposes clickable live cam link and resident filter tabs", async ({ app, screen, browser }) => {
  const { notice, zoo } = fixture();

  await recordOpenedTabs(browser);
  await browser.route(new RegExp(`/api/v2/institutions/${zoo.slug}$`), async (route) => {
    const upstream = await route.fetch();
    const headers = Object.fromEntries(
      Object.entries(upstream.headers).filter(([name]) => !["content-length", "content-encoding"].includes(name.toLowerCase())),
    );
    if (upstream.status !== 200) {
      await route.fulfill({ status: upstream.status, headers, body: await upstream.text() });
      return;
    }
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
  await expect(screen.getByRole("tab", { name: "全部 2", selected: true })).toBeVisible();
  const unseenTab = screen.getByRole("tab", "未见过 2");
  await expect(unseenTab).toBeVisible();
  await unseenTab.tap();
  await expect(screen.getByRole("tab", { name: "未见过 2", selected: true })).toBeVisible();
  await expect(screen.getByRole("link", notice.name)).toBeVisible();
});
