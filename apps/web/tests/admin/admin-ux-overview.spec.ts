import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("staff dashboard prioritizes real review and curation work over internal session metadata", async ({ page }) => {
  const observed: string[] = [];
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      accountId: "11111111-1111-4111-8111-111111111111", aal: "aal2",
      capabilities: ["admin.shell.access", "review.case.read", "curation.change.read", "audit.read"],
    }),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => {
    const search = new URL(route.request().url()).searchParams;
    observed.push(`review:${search.get("state")}`);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      items: [], total: search.get("state") === "new" ? 3 : 0, limit: 1, offset: 0,
    }) });
  });
  await page.route("**/api/admin/curation/change-sets?**", (route) => {
    const search = new URL(route.request().url()).searchParams;
    observed.push(`curation:${search.get("state")}`);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      items: [], total: search.get("state") === "validated" ? 2 : 0, limit: 1, offset: 0,
    }) });
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "数据运营工作台" })).toBeVisible();
  const work = page.getByRole("region", { name: "待处理的工作" });
  await expect(work.getByText("待分派审核案件")).toBeVisible();
  await expect(work.getByText("3", { exact: true })).toBeVisible();
  await expect(work.getByRole("link", { name: "进入审核队列" })).toHaveAttribute("href", "/admin/reviews?state=new");
  await expect(work.getByText("等待独立审批的变更")).toBeVisible();
  await expect(work.getByText("2", { exact: true })).toBeVisible();
  await expect(work.getByRole("link", { name: "进入策展变更" })).toHaveAttribute("href", "/admin/curation?state=validated");
  await work.getByRole("link", { name: "进入审核队列" }).focus();
  await expect(work.getByRole("link", { name: "进入审核队列" })).toBeFocused();
  await expect(page.getByText("可用工作区")).toBeVisible();
  await expect(page.getByText("身份保证级别")).toHaveCount(0);
  await expect(page.getByText("11111111-1111-4111-8111-111111111111")).toHaveCount(0);
  expect(observed).toContain("review:new");
  expect(observed).toContain("curation:validated");

  const violations = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.violations).toEqual([]);
});

test("staff without queue permissions sees accessible destinations but no imaginary work counters", async ({ page }) => {
  let forbiddenCalls = 0;
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      accountId: "11111111-1111-4111-8111-111111111111", aal: "aal2",
      capabilities: ["admin.shell.access", "audit.read"],
    }),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => { forbiddenCalls += 1; return route.abort(); });
  await page.route("**/api/admin/curation/change-sets?**", (route) => { forbiddenCalls += 1; return route.abort(); });
  await page.goto("/admin");
  await expect(page.getByText("当前没有可在首页处理的任务队列。", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看审计证据" })).toHaveAttribute("href", "/admin/audit/evidence");
  await expect(page.getByText("可用工作区")).toBeVisible();
  expect(forbiddenCalls).toBe(0);
});

test("dashboard does not replace failed queue reads with fabricated zeros", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      accountId: "11111111-1111-4111-8111-111111111111", aal: "aal2",
      capabilities: ["admin.shell.access", "review.case.read"],
    }),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Service unavailable" }),
  }));
  await page.goto("/admin");
  const work = page.getByRole("region", { name: "待处理的工作" });
  await expect(work.getByText("暂时无法读取")).toBeVisible();
  await expect(work.getByText("可以进入队列检查并重试")).toBeVisible();
  await expect(work.getByRole("link", { name: "进入审核队列" })).toBeVisible();
  await expect(work.getByText("0", { exact: true })).toHaveCount(0);
});

test("empty work queues clearly say there is nothing awaiting action", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      accountId: "11111111-1111-4111-8111-111111111111", aal: "aal2",
      capabilities: ["admin.shell.access", "review.case.read", "curation.change.read"],
    }),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, limit: 1, offset: 0 }),
  }));
  await page.route("**/api/admin/curation/change-sets?**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, limit: 1, offset: 0 }),
  }));
  await page.goto("/admin");
  await expect(page.getByText("目前没有新提交的案件")).toBeVisible();
  await expect(page.getByText("目前没有等待审批的变更")).toBeVisible();
});
