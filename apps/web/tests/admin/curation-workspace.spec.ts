import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const changeSetId = "55555555-5555-4555-8555-555555555555";
const pandaId = "66666666-6666-4666-8666-666666666666";

test("Curation uses a typed paginated collection and approves a reviewed change without JSON operations", async ({ page }) => {
  let state: "draft" | "validated" | "applied" = "draft";
  let approvals = 0;
  const actor = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/admin/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    accountId: actor, aal: "aal2", capabilities: ["curation.change.read", "curation.change.manage", "curation.change.approve"],
  }) }));
  await page.route("**/api/admin/curation/change-sets**", async (route) => {
    const url = new URL(route.request().url());
    const action = url.pathname.endsWith("/validate") ? "validate" : url.pathname.endsWith("/approve") ? "approve" : "";
    if (route.request().method() === "POST") {
      if (action === "approve") {
        approvals += 1;
        const input = route.request().postDataJSON() as { reason: string };
        expect(input.reason).toBe("机构来源和独立核验均已确认");
        state = "applied";
      } else if (action === "validate") state = "validated";
    }
    const detail = {
      changeSetId, targetPandaId: pandaId, state, version: state === "draft" ? 1 : 2,
      originKind: "review", reason: "来源机构的事实更正", createdByAccountId: "22222222-2222-4222-8222-222222222222",
      changes: [{ changeId: "77777777-7777-4777-8777-777777777777", fieldKey: "profile.sex", assertionKey: "sex-correction", value: "female", certainty: "confirmed", lastVerifiedOn: "2026-08-26", sourceIds: ["institution-1"] }], ownerChanges: [],
    };
    if (url.pathname.endsWith("/change-sets")) {
      expect(url.searchParams.get("state")).toBe("draft");
      expect(url.searchParams.get("limit")).toBe("10");
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{
        changeSetId, targetPandaId: pandaId, state: "draft", originKind: "review", version: 1,
        reason: detail.reason, createdByAccountId: detail.createdByAccountId, createdAt: "2026-10-08T08:30:00.000Z", changeCount: 1,
      }], total: 1, limit: 10, offset: 0 }) });
    } else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detail) });
  });

  await page.goto("/admin/curation?state=draft");
  await expect(page.getByRole("heading", { name: "策展变更集", level: 1 })).toBeVisible();
  await expect(page.getByRole("cell", { name: "来源机构的事实更正" })).toBeVisible();
  await page.getByRole("button", { name: "查看变更" }).click();
  await expect(page.getByText("性别", { exact: true })).toBeVisible();
  await expect(page.getByText("雌性", { exact: true })).toBeVisible();
  await expect(page.getByText("当前档案值尚未提供，不能据此判断是否替换现有事实。")).toBeVisible();
  await page.getByText("查看来源标识").click();
  await expect(page.getByText("institution-1")).toBeVisible();
  await page.getByRole("button", { name: "核验变更集" }).click();
  await expect(page.getByRole("region", { name: "策展变更详情" }).getByText("已核验", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "审批原因" }).fill("机构来源和独立核验均已确认");
  await page.getByRole("button", { name: "审批并应用" }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("公开发布仍需单独处理");
  expect(approvals).toBe(0);
  await confirmation.getByRole("button", { name: "取消" }).click();
  expect(approvals).toBe(0);
  await page.getByRole("button", { name: "审批并应用" }).click();
  await expect(confirmation).toBeVisible();
  const modalAxe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(modalAxe.violations).toEqual([]);
  await confirmation.getByRole("button", { name: "确认审批并应用" }).click();
  await expect.poll(() => approvals).toBe(1);
  await expect(page.getByRole("status")).toContainText("已审批并应用");
  await expect(page.getByRole("textbox", { name: "JSON" })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("Curation never offers self-approval, even if the creator has the approval capability", async ({ page }) => {
  const actor = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/admin/session", (route) => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ accountId: actor, aal: "aal2", capabilities: ["curation.change.read", "curation.change.approve"] }),
  }));
  await page.route("**/api/admin/curation/change-sets**", (route) => {
    const url = new URL(route.request().url());
    const data = url.pathname.endsWith("/change-sets")
      ? { items: [{ changeSetId, targetPandaId: pandaId, state: "validated", originKind: "review", version: 2,
        reason: "待独立审批", createdByAccountId: actor, createdAt: "2026-10-08T08:30:00.000Z", changeCount: 1 }], total: 1, limit: 10, offset: 0 }
      : { changeSetId, targetPandaId: pandaId, state: "validated", originKind: "review", version: 2,
        reason: "待独立审批", createdByAccountId: actor, changes: [], ownerChanges: [] };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/admin/curation");
  await page.getByRole("button", { name: "查看变更" }).click();
  await expect(page.getByText("创建人不能审批自己提出的变更集")).toBeVisible();
  await expect(page.getByRole("button", { name: "核验变更集" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "审批原因" }).fill("已核对所有证据");
  await expect(page.getByRole("button", { name: "审批并应用" })).toBeDisabled();
});
