import { describe, expect, it } from "vitest";

import {
  type PrivacyRequest,
  canRequest,
  exportFileName,
  latestRequest,
  requestReason,
  requestStatus,
} from "./privacy";

const request = (overrides: Partial<PrivacyRequest>): PrivacyRequest => ({
  requestId: "r1",
  kind: "access_export",
  state: "pending",
  reason: "x",
  requestedAt: "2026-10-26T06:00:00.000Z",
  updatedAt: "2026-10-26T06:00:00.000Z",
  ...overrides,
});

describe("latestRequest", () => {
  it("takes the newest request of a kind", () => {
    const requests = [
      request({ requestId: "new-export" }),
      request({ requestId: "deletion", kind: "account_deletion" }),
      request({ requestId: "old-export" }),
    ];
    expect(latestRequest(requests, "access_export")?.requestId).toBe("new-export");
    expect(latestRequest(requests, "account_deletion")?.requestId).toBe("deletion");
    expect(latestRequest([], "access_export")).toBeNull();
  });
});

describe("canRequest", () => {
  it("waits for a request in flight, and allows a new export once one is done", () => {
    expect(canRequest(null)).toBe(true);
    expect(canRequest(request({ state: "processing" }))).toBe(false);
    expect(canRequest(request({ state: "completed" }))).toBe(true);
    expect(canRequest(request({ kind: "account_deletion", state: "completed" }))).toBe(false);
    expect(canRequest(request({ kind: "account_deletion", state: "failed" }))).toBe(true);
  });
});

describe("requestStatus and requestReason", () => {
  it("words each state for the kind", () => {
    expect(requestStatus(request({ state: "completed" }))).toBe("已准备好");
    expect(requestStatus(request({ kind: "account_deletion", state: "pending" }))).toBe("已提交，等待处理");
  });

  it("falls back to the default reason below the API's minimum", () => {
    expect(requestReason("account_deletion", " 不用了 ")).toBe("不用了");
    expect(requestReason("account_deletion", " 走 ")).toBe("在 App 中申请注销账号。");
  });

  it("names the export file by its day", () => {
    expect(exportFileName("2026-10-26T06:00:00.000Z")).toBe("zhipanda-export-2026-10-26.json");
  });
});
