import { describe, expect, it } from "vitest";

import { type Message, type Preference, messageTime, messageView, preferenceRows, unreadCount } from "./notifications";

const message = (content: Record<string, unknown>, overrides: Partial<Message> = {}): Message => ({
  messageId: "m1",
  category: "knowledge_update",
  content,
  createdAt: "2026-10-26T06:05:00.000Z",
  seenAt: null,
  readAt: null,
  ...overrides,
});

const names = (pandaId: string) => (pandaId === "p1" ? "和花" : null);

describe("messageView", () => {
  it("summarizes a knowledge update", () => {
    expect(
      messageView(
        message({ kind: "knowledge_update", releaseVersion: "2026.10.26.1", changedResourceCount: 3 }),
        names,
      ),
    ).toEqual({
      title: "关注的熊猫资料更新了",
      detail: "3 处变化　版本 2026.10.26.1",
      pandaId: null,
    });
  });

  it("names the panda taken down or restored, and opens it only once it is public again", () => {
    const control = (action: string) =>
      message(
        { kind: "publication_control", action, resourceKind: "panda", resourceId: "p1" },
        { category: "correction" },
      );
    expect(messageView(control("restored"), names)).toEqual({
      title: "和花的资料恢复公开了",
      detail: null,
      pandaId: "p1",
    });
    expect(messageView(control("taken_down"), names)).toMatchObject({ title: "和花的资料暂时下线核对", pandaId: null });
  });

  it("reads erased and unknown content as plain notices", () => {
    expect(messageView(message({ erased: true }), names).title).toBe("这条通知已清除");
    expect(messageView(message({ kind: "future" }, { category: "correction" }), names).title).toBe("资料有更正");
  });
});

describe("unreadCount", () => {
  it("counts messages without a read time", () => {
    expect(unreadCount([message({}), message({}, { readAt: "2026-10-26T07:00:00.000Z" })])).toBe(1);
  });
});

describe("preferenceRows", () => {
  it("keeps a fixed order and the API's values", () => {
    const preference = (
      category: Preference["category"],
      channel: Preference["channel"],
      enabled: boolean,
    ): Preference => ({
      category,
      channel,
      enabled,
      version: 0,
      updatedAt: null,
    });
    const rows = preferenceRows([
      preference("correction", "email", true),
      preference("knowledge_update", "station", true),
      preference("knowledge_update", "email", false),
      preference("correction", "station", false),
    ]);
    expect(rows.map((row) => `${row.label} ${row.enabled}`)).toEqual([
      "资料更新，App 内通知 true",
      "资料更新，邮件 false",
      "资料下线或恢复，App 内通知 false",
      "资料下线或恢复，邮件 true",
    ]);
  });
});

describe("messageTime", () => {
  it("leaves out the current year", () => {
    const now = new Date(2026, 9, 26, 12);
    expect(messageTime(new Date(2026, 9, 26, 14, 5).toISOString(), now)).toBe("10月26日 14:05");
    expect(messageTime(new Date(2025, 0, 2, 9, 0).toISOString(), now)).toBe("2025年1月2日 09:00");
  });
});
