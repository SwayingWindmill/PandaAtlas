import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const currentReleaseId = "11111111-1111-4111-8111-111111111111";
const candidateReleaseId = "22222222-2222-4222-8222-222222222222";

const publicationSession = {
  accountId: "33333333-3333-4333-8333-333333333333",
  aal: "aal2",
  capabilities: ["publication.release.manage", "publication.release.activate", "publication.emergency"],
};

const counts = {
  panda: 12,
  institution: 3,
  place: 4,
  lineage: 8,
  residency: 10,
  lifeEvent: 6,
  media: 15,
  evidence: 9,
};

test("publication release list can retry a failed read without losing lifecycle filter", async ({ page }) => {
  let fail = true;
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(publicationSession),
  }));
  await page.route("**/api/admin/publication/releases?**", (route) => route.fulfill(fail
    ? { status: 503, contentType: "application/problem+json", body: JSON.stringify({ detail: "发布列表暂时不可用" }) }
    : { status: 200, contentType: "application/json", body: JSON.stringify({
      items: [], total: 0, limit: 10, offset: 0, currentReleaseId: null, currentRelease: null,
    }) }));
  await page.goto("/admin/publication?state=sealed");
  const retry = page.getByRole("button", { name: "重试加载版本列表" });
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "启用版本", exact: true })).toHaveCount(0);
  fail = false;
  await retry.click();
  await expect(page.getByText("当前筛选条件下没有版本记录；可选择其他生命周期查看。")).toBeVisible();
  await expect(page).toHaveURL(/state=sealed/);
});

test("a direct release URL cannot offer activation while current release status is unknown", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(publicationSession),
  }));
  await page.route("**/api/admin/publication/releases?**", (route) => route.fulfill({
    status: 503, contentType: "application/problem+json", body: JSON.stringify({ detail: "当前版本列表不可用" }),
  }));
  await page.route(`**/api/admin/publication/releases/${candidateReleaseId}*`, (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      release: {
        releaseId: candidateReleaseId, version: "2026.10.05.2", lifecycleState: "sealed", isCurrent: false,
        suspended: false, projectionSchemaVersion: 1, builtAt: "2026-10-10T08:00:00Z", blockers: [], counts,
      },
      currentReleaseId: null, changes: [], changeTotal: 0, changeOffset: 0, changeItems: [], transitions: [],
    }),
  }));
  await page.goto(`/admin/publication?release=${candidateReleaseId}`);
  await expect(page.getByRole("heading", { name: "2026.10.05.2" })).toBeVisible();
  await expect(page.getByText("无法确认当前公开版本。", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "启用版本", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "回滚至此版本" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "暂停版本" })).toHaveCount(0);
});

test("publication control plane shows releases, counts, diff, history, and typed lifecycle controls", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicationSession) });
  });
  await page.route("**/api/admin/publication/releases?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        currentReleaseId,
        currentRelease: {
          releaseId: currentReleaseId,
          version: "2026.10.05.1",
          projectionSchemaVersion: 1,
          lifecycleState: "sealed",
          builtAt: "2026-10-05T08:00:00.000Z",
          sealedAt: "2026-10-05T08:10:00.000Z",
          contentSha256: "a".repeat(64),
          isCurrent: true,
          suspended: false,
          counts,
          blockers: ["This is the current public release."],
        },
        total: 2,
        limit: 10,
        offset: 0,
        items: [
          {
            releaseId: candidateReleaseId,
            version: "2026.10.05.2",
            projectionSchemaVersion: 1,
            lifecycleState: "sealed",
            builtAt: "2026-10-05T09:00:00.000Z",
            sealedAt: "2026-10-05T09:10:00.000Z",
            contentSha256: "b".repeat(64),
            isCurrent: false,
            suspended: false,
            counts: { ...counts, panda: 13, media: 16 },
            blockers: [],
          },
          {
            releaseId: currentReleaseId,
            version: "2026.10.05.1",
            projectionSchemaVersion: 1,
            lifecycleState: "sealed",
            builtAt: "2026-10-05T08:00:00.000Z",
            sealedAt: "2026-10-05T08:10:00.000Z",
            contentSha256: "a".repeat(64),
            isCurrent: true,
            suspended: false,
            counts,
            blockers: [],
          },
        ],
      }),
    });
  });
  await page.route(`**/api/admin/publication/releases/${candidateReleaseId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        currentReleaseId,
        release: {
          releaseId: candidateReleaseId,
          version: "2026.10.05.2",
          projectionSchemaVersion: 1,
          lifecycleState: "sealed",
          builtAt: "2026-10-05T09:00:00.000Z",
          sealedAt: "2026-10-05T09:10:00.000Z",
          contentSha256: "b".repeat(64),
          isCurrent: false,
          suspended: false,
          counts: { ...counts, panda: 13, media: 16 },
          blockers: [],
        },
        changes: [
          { resourceKind: "panda", added: 1, changed: 2, removed: 0 },
          { resourceKind: "media", added: 1, changed: 0, removed: 0 },
        ],
        changeTotal: 4,
        changeOffset: 0,
        changeItems: [
          { resourceKind: "panda", resourceId: "panda-added-01", changeType: "added" },
          { resourceKind: "panda", resourceId: "panda-changed-01", changeType: "changed" },
          { resourceKind: "panda", resourceId: "panda-changed-02", changeType: "changed" },
          { resourceKind: "media", resourceId: "media-added-01", changeType: "added" },
        ],
        transitions: [
          {
            transitionId: "44444444-4444-4444-8444-444444444444",
            transitionType: "sealed",
            actor: "account:33333333-3333-4333-8333-333333333333",
            reason: "Reviewed for release.",
            occurredAt: "2026-10-05T09:10:00.000Z",
          },
        ],
      }),
    });
  });

  await page.goto(`/admin/publication?release=${candidateReleaseId}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("heading", { level: 2, name: "2026.10.05.2" })).toBeVisible();
  const queue = page.getByRole("region", { name: "版本队列" });
  const inspection = page.getByRole("region", { name: "所选版本检查" });
  await expect(queue).toBeVisible();
  await expect(inspection).toBeVisible();
  const queuePosition = await queue.boundingBox();
  const inspectionPosition = await inspection.boundingBox();
  expect(queuePosition && inspectionPosition && queuePosition.x + queuePosition.width <= inspectionPosition.x).toBe(true);
  const divider = page.getByRole("separator", { name: "调整版本队列与检查详情宽度" });
  const widthBefore = queuePosition?.width ?? 0;
  await divider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await queue.boundingBox())?.width ?? 0).toBeGreaterThan(widthBefore);

  await expect(page.getByRole("heading", { level: 1, name: "发布管理" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2026.10.05.1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2026.10.05.2" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "2026.10.05.2" })).toBeVisible();
  await expect(page.getByText("熊猫").first()).toBeVisible();
  await expect(page.getByText("机构").first()).toBeVisible();
  await expect(page.getByText("13", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("居住史").first()).toBeVisible();
  await expect(page.getByText("生命事件").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "与当前版本的差异" })).toBeVisible();
  await expect(page.getByText("新增 1 · 更新 2 · 移除 0")).toBeVisible();
  await expect(page.getByRole("heading", { name: "状态变更记录" })).toBeVisible();
  await expect(page.getByText("Reviewed for release.")).toBeVisible();
  await expect(page.getByLabel("操作原因")).toBeVisible();
  await expect(page.getByRole("button", { name: "启用版本" })).toBeVisible();
  await expect(page.getByLabel("JSON payload")).toHaveCount(0);
  const candidate = page.getByRole("button", { name: "查看版本 2026.10.05.2" });
  await candidate.focus();
  await expect(candidate).toBeFocused();
  await expect(candidate).toHaveAttribute("aria-pressed", "true");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("publication inspection exposes concrete changed resource IDs with safe paging and impact context", async ({ page }) => {
  const requestedOffsets: number[] = [];
  const changedResources = Array.from({ length: 23 }, (_, index) => ({
    resourceKind: index < 12 ? "panda" : "media",
    resourceId: `resource-${String(index + 1).padStart(3, "0")}`,
    changeType: index < 12 ? "changed" : "removed",
  }));
  await page.route("**/api/admin/session", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicationSession) }));
  await page.route("**/api/admin/publication/releases?**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    currentReleaseId,
    currentRelease: { releaseId: currentReleaseId, version: "2026.10.05.1", lifecycleState: "sealed", builtAt: "2026-10-05T08:00:00.000Z", isCurrent: true, suspended: false, projectionSchemaVersion: 1, counts, blockers: [] },
    total: 1, limit: 10, offset: 0,
    items: [{ releaseId: candidateReleaseId, version: "2026.10.05.2", lifecycleState: "sealed", builtAt: "2026-10-05T09:00:00.000Z", isCurrent: false, suspended: false, projectionSchemaVersion: 1, counts, blockers: [] }],
  }) }));
  await page.route(`**/api/admin/publication/releases/${candidateReleaseId}*`, route => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get("changeOffset") ?? "0");
    requestedOffsets.push(offset);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      currentReleaseId,
      release: { releaseId: candidateReleaseId, version: "2026.10.05.2", lifecycleState: "sealed", builtAt: "2026-10-05T09:00:00.000Z", isCurrent: false, suspended: false, projectionSchemaVersion: 1, counts, blockers: [] },
      changes: [{ resourceKind: "panda", added: 0, changed: 12, removed: 0 }, { resourceKind: "media", added: 0, changed: 0, removed: 11 }],
      changeTotal: changedResources.length, changeOffset: offset, changeItems: changedResources.slice(offset, offset + 10), transitions: [],
    }) });
  });
  await page.goto(`/admin/publication?release=${candidateReleaseId}`);
  await expect(page.getByRole("heading", { name: "受影响资源明细" })).toBeVisible();
  await expect(page.getByText("23 条资源成员变更")).toBeVisible();
  await expect(page.getByText("resource-001", { exact: true })).toBeVisible();
  await expect(page.getByText("resource-011", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/不代表字段级差异/)).toBeVisible();
  await page.getByText("resource-008", { exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "下一页差异" }).click();
  await expect(page.getByText("resource-011", { exact: true })).toBeVisible();
  await expect(page.getByText("resource-001", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(250);
  await expect.poll(() => requestedOffsets).toContain(10);
  await page.getByLabel("操作原因").fill("Review candidate impact.");
  await page.getByRole("button", { name: "启用版本" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("23 条资源成员变更");
  await expect(page.getByRole("alertdialog")).toContainText("11 条移除");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("publication inspection failure gives a retry without losing the chosen version", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/admin/session", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicationSession) }));
  await page.route("**/api/admin/publication/releases?**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    currentReleaseId, total: 1, limit: 10, offset: 0,
    currentRelease: { releaseId: currentReleaseId, version: "2026.10.05.1", lifecycleState: "sealed", builtAt: "2026-10-05T08:00:00Z", projectionSchemaVersion: 1, isCurrent: true, suspended: false, counts, blockers: [] },
    items: [{ releaseId: candidateReleaseId, version: "2026.10.05.2", lifecycleState: "sealed", builtAt: "2026-10-05T09:00:00Z", projectionSchemaVersion: 1, isCurrent: false, suspended: false, counts, blockers: [] }],
  }) }));
  await page.route(`**/api/admin/publication/releases/${candidateReleaseId}*`, route => {
    attempts += 1;
    return route.fulfill(attempts === 1
      ? { status: 503, contentType: "application/json", body: JSON.stringify({ detail: "暂时无法读取版本详情" }) }
      : { status: 200, contentType: "application/json", body: JSON.stringify({
        currentReleaseId, release: { releaseId: candidateReleaseId, version: "2026.10.05.2", lifecycleState: "sealed", builtAt: "2026-10-05T09:00:00Z", projectionSchemaVersion: 1, isCurrent: false, suspended: false, counts, blockers: [] },
        changes: [], changeTotal: 0, changeOffset: 0, changeItems: [], transitions: [],
      }) });
  });
  await page.goto(`/admin/publication?release=${candidateReleaseId}`);
  await expect(page.getByRole("region", { name: "所选版本检查" }).getByRole("alert")).toContainText("暂时无法读取版本详情");
  await page.getByRole("button", { name: "重新加载版本详情" }).click();
  await expect(page.getByText(/没有检测到资源成员的新增/)).toBeVisible();
  expect(attempts).toBe(2);
  await expect(page).toHaveURL(new RegExp(`release=${candidateReleaseId}`));
});

test("publication activation uses a typed reason and refreshes the release inspection", async ({ page }) => {
  let activated = false;
  let recentAuthExpired = true;
  let actionBody: unknown;
  let listReads = 0;
  let inspectionReads = 0;

  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicationSession) });
  });
  await page.route("**/api/admin/publication/releases?**", async (route) => {
    listReads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        currentReleaseId: activated ? candidateReleaseId : currentReleaseId,
        currentRelease: activated ? {
          releaseId: candidateReleaseId,
          version: "2026.10.05.2",
          projectionSchemaVersion: 1,
          lifecycleState: "sealed",
          builtAt: "2026-10-05T09:00:00.000Z",
          sealedAt: "2026-10-05T09:10:00.000Z",
          contentSha256: "b".repeat(64),
          isCurrent: true,
          suspended: false,
          counts: { ...counts, panda: 13 },
          blockers: ["This is the current public release."],
        } : {
          releaseId: currentReleaseId,
          version: "2026.10.05.1",
          projectionSchemaVersion: 1,
          lifecycleState: "sealed",
          builtAt: "2026-10-05T08:00:00.000Z",
          sealedAt: "2026-10-05T08:10:00.000Z",
          contentSha256: "a".repeat(64),
          isCurrent: true,
          suspended: false,
          counts,
          blockers: ["This is the current public release."],
        },
        total: 2,
        limit: 10,
        offset: 0,
        items: [
          {
            releaseId: candidateReleaseId,
            version: "2026.10.05.2",
            projectionSchemaVersion: 1,
            lifecycleState: "sealed",
            builtAt: "2026-10-05T09:00:00.000Z",
            sealedAt: "2026-10-05T09:10:00.000Z",
            contentSha256: "b".repeat(64),
            isCurrent: activated,
            suspended: false,
            counts: { ...counts, panda: 13 },
            blockers: activated ? ["This is the current public release."] : [],
          },
          {
            releaseId: currentReleaseId,
            version: "2026.10.05.1",
            projectionSchemaVersion: 1,
            lifecycleState: "sealed",
            builtAt: "2026-10-05T08:00:00.000Z",
            sealedAt: "2026-10-05T08:10:00.000Z",
            contentSha256: "a".repeat(64),
            isCurrent: !activated,
            suspended: false,
            counts,
            blockers: !activated ? ["This is the current public release."] : [],
          },
        ],
      }),
    });
  });
  await page.route(`**/api/admin/publication/releases/${candidateReleaseId}`, async (route) => {
    inspectionReads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        currentReleaseId: activated ? candidateReleaseId : currentReleaseId,
        release: {
          releaseId: candidateReleaseId,
          version: "2026.10.05.2",
          projectionSchemaVersion: 1,
          lifecycleState: "sealed",
          builtAt: "2026-10-05T09:00:00.000Z",
          sealedAt: "2026-10-05T09:10:00.000Z",
          contentSha256: "b".repeat(64),
          isCurrent: activated,
          suspended: false,
          counts: { ...counts, panda: 13 },
          blockers: activated ? ["This is the current public release."] : [],
        },
        changes: activated ? [] : [{ resourceKind: "panda", added: 1, changed: 0, removed: 0 }],
        changeTotal: activated ? 0 : 1, changeOffset: 0,
        changeItems: activated ? [] : [{ resourceKind: "panda", resourceId: "panda-new", changeType: "added" }],
        transitions: activated ? [{
          transitionId: "55555555-5555-4555-8555-555555555555",
          transitionType: "activated",
          actor: "account:33333333-3333-4333-8333-333333333333",
          reason: "Promote reviewed candidate.",
          occurredAt: "2026-10-05T09:30:00.000Z",
        }] : [],
      }),
    });
  });
  await page.route(`**/api/admin/publication/releases/${candidateReleaseId}/actions`, async (route) => {
    if (recentAuthExpired) {
      recentAuthExpired = false;
      return route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ code: "auth.recentAuthRequired", detail: "Recent interactive authentication is required." }),
      });
    }
    actionBody = route.request().postDataJSON();
    activated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        releaseId: candidateReleaseId,
        version: "2026.10.05.2",
        projectionSchemaVersion: 1,
        lifecycleState: "sealed",
        builtAt: "2026-10-05T09:00:00.000Z",
        sealedAt: "2026-10-05T09:10:00.000Z",
        contentSha256: "b".repeat(64),
      }),
    });
  });

  await page.goto(`/admin/publication?release=${candidateReleaseId}`);
  await page.getByLabel("操作原因").fill("Promote reviewed candidate.");
  await page.getByRole("button", { name: "启用版本" }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("2026.10.05.2");
  await expect(confirmation).toContainText("2026.10.05.1");
  expect(actionBody).toBeUndefined();
  await confirmation.getByRole("button", { name: "取消" }).click();
  expect(actionBody).toBeUndefined();
  await page.getByRole("button", { name: "启用版本" }).click();
  await confirmation.getByRole("button", { name: "确认启用版本" }).click();
  await expect(page.getByRole("region", { name: "所选版本检查" }).getByRole("alert")).toContainText("此敏感操作的近期身份验证已过期");
  await expect(page.getByRole("link", { name: "重新登录" })).toHaveAttribute("href", "/auth/login?next=%2Fadmin%2Fpublication");
  expect(actionBody).toBeUndefined();
  await page.getByRole("button", { name: "启用版本" }).click();
  await confirmation.getByRole("button", { name: "确认启用版本" }).click();

  await expect.poll(() => actionBody).toEqual({ action: "activate", reason: "Promote reviewed candidate." });
  await expect(page.getByRole("status")).toContainText("已启用 2026.10.05.2。");
  await expect(page.getByText("当前版本 · 已封存")).toBeVisible();
  expect(listReads).toBeGreaterThan(1);
  expect(inspectionReads).toBeGreaterThan(1);
});

test("publication lifecycle controls stay capability scoped", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...publicationSession, capabilities: ["publication.release.manage"] }),
    });
  });
  await page.route("**/api/admin/publication/releases?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        currentReleaseId,
        currentRelease: {
          releaseId: currentReleaseId,
          version: "2026.10.05.1",
          projectionSchemaVersion: 1,
          lifecycleState: "sealed",
          builtAt: "2026-10-05T08:00:00.000Z",
          sealedAt: "2026-10-05T08:10:00.000Z",
          contentSha256: "a".repeat(64),
          isCurrent: true,
          suspended: false,
          counts,
          blockers: ["This is the current public release."],
        },
        total: 1,
        limit: 10,
        offset: 0,
        items: [{
          releaseId: candidateReleaseId,
          version: "2026.10.05.2",
          projectionSchemaVersion: 1,
          lifecycleState: "sealed",
          builtAt: "2026-10-05T09:00:00.000Z",
          sealedAt: "2026-10-05T09:10:00.000Z",
          contentSha256: "b".repeat(64),
          isCurrent: false,
          suspended: false,
          counts,
          blockers: [],
        }],
      }),
    });
  });
  await page.route(`**/api/admin/publication/releases/${candidateReleaseId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        currentReleaseId,
        release: {
          releaseId: candidateReleaseId,
          version: "2026.10.05.2",
          projectionSchemaVersion: 1,
          lifecycleState: "sealed",
          builtAt: "2026-10-05T09:00:00.000Z",
          sealedAt: "2026-10-05T09:10:00.000Z",
          contentSha256: "b".repeat(64),
          isCurrent: false,
          suspended: false,
          counts,
          blockers: [],
        },
        changes: [], changeTotal: 0, changeOffset: 0, changeItems: [],
        transitions: [],
      }),
    });
  });

  await page.goto(`/admin/publication?release=${candidateReleaseId}`);

  await expect(page.getByRole("button", { name: "启用版本" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "暂停版本" })).toHaveCount(0);
  await page.getByText("构建新候选版本（按需展开）").click();
  await expect(page.getByRole("button", { name: "构建版本" })).toBeVisible();
});

test("publication collection keeps lifecycle filtering and pagination in the URL", async ({ page }) => {
  const requests: Array<{ limit: string | null; offset: string | null; lifecycleState: string | null }> = [];
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicationSession) });
  });
  await page.route("**/api/admin/publication/releases?**", async (route) => {
    const url = new URL(route.request().url());
    requests.push({
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
      lifecycleState: url.searchParams.get("lifecycleState"),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total: 25, limit: 10, offset: Number(url.searchParams.get("offset") ?? 0), items: [] }),
    });
  });

  await page.goto("/admin/publication");
  await expect(page.getByText("第 1 / 3 页 · 共 25 个版本")).toBeVisible();

  await page.getByLabel("生命周期").selectOption("sealed");
  await expect(page).toHaveURL(/\/admin\/publication\?state=sealed$/);
  await expect.poll(() => requests.at(-1)).toEqual({ limit: "10", offset: "0", lifecycleState: "sealed" });

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/\/admin\/publication\?state=sealed&page=2$/);
  await expect.poll(() => requests.at(-1)).toEqual({ limit: "10", offset: "10", lifecycleState: "sealed" });
});
