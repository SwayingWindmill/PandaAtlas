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

  await expect(page.getByRole("heading", { level: 1, name: "Publication control plane" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2026.10.05.1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2026.10.05.2" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "2026.10.05.2" })).toBeVisible();
  await expect(page.getByText("Pandas").first()).toBeVisible();
  await expect(page.getByText("13", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Residencies").first()).toBeVisible();
  await expect(page.getByText("Life events").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Changes vs current release" })).toBeVisible();
  await expect(page.getByText("1 added · 2 changed · 0 removed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Transition history" })).toBeVisible();
  await expect(page.getByText("Reviewed for release.")).toBeVisible();
  await expect(page.getByLabel("Reason")).toBeVisible();
  await expect(page.getByRole("button", { name: "Activate release" })).toBeVisible();
  await expect(page.getByLabel("JSON payload")).toHaveCount(0);
});

test("publication activation uses a typed reason and refreshes the release inspection", async ({ page }) => {
  let activated = false;
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
  await page.getByLabel("Reason").fill("Promote reviewed candidate.");
  await page.getByRole("button", { name: "Activate release" }).click();

  await expect.poll(() => actionBody).toEqual({ action: "activate", reason: "Promote reviewed candidate." });
  await expect(page.getByRole("status")).toContainText("Activated 2026.10.05.2.");
  await expect(page.getByText("Current · sealed")).toBeVisible();
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
        changes: [],
        transitions: [],
      }),
    });
  });

  await page.goto(`/admin/publication?release=${candidateReleaseId}`);

  await expect(page.getByRole("button", { name: "Activate release" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Suspend release" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Build release" })).toBeVisible();
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
  await expect(page.getByText("Page 1 of 3 · 25 releases")).toBeVisible();

  await page.getByLabel("Lifecycle").selectOption("sealed");
  await expect(page).toHaveURL(/\/admin\/publication\?state=sealed$/);
  await expect.poll(() => requests.at(-1)).toEqual({ limit: "10", offset: "0", lifecycleState: "sealed" });

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/admin\/publication\?state=sealed&page=2$/);
  await expect.poll(() => requests.at(-1)).toEqual({ limit: "10", offset: "10", lifecycleState: "sealed" });
});
