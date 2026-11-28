import { describe, expect, it } from "vitest";

import { type Message, type Preference, messageTime, messageView, preferenceRows, unreadCount } from "./notifications";
import { resolveNotificationHref } from "./push-routing";

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
const slugs = (pandaId: string) => (pandaId === "p1" ? "he-hua" : null);

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
      href: "/notifications",
    });
  });

  it("summarizes birthday reminders and panda/venue news with deep links", () => {
    expect(
      messageView(
        message(
          { kind: "birthday_reminder", pandaId: "p1", pandaSlug: "he-hua", pandaName: "和花", age: 6, leadDays: 1 },
          { category: "birthday_reminder" },
        ),
        names,
        slugs,
      ),
    ).toEqual({
      title: "明天是和花6岁生日",
      detail: "提前祝和花生日快乐",
      pandaId: "p1",
      href: "/pandas/he-hua",
    });

    expect(
      messageView(
        message(
          { kind: "panda_news", pandaId: "p1", pandaSlug: "he-hua", pandaName: "和花", title: "清晨啃笋营业" },
          { category: "panda_news" },
        ),
        names,
        slugs,
      ),
    ).toEqual({
      title: "和花有新动态",
      detail: "清晨啃笋营业",
      pandaId: "p1",
      href: "/pandas/he-hua",
    });

    expect(
      messageView(
        message(
          {
            kind: "venue_news",
            institutionSlug: "chengdu-research-base",
            institutionName: "成都大熊猫繁育研究基地",
            title: "幼年大熊猫别墅临时保养通知",
          },
          { category: "venue_news" },
        ),
        names,
      ),
    ).toEqual({
      title: "成都大熊猫繁育研究基地有新公告",
      detail: "幼年大熊猫别墅临时保养通知",
      pandaId: null,
      href: "/institutions/chengdu-research-base",
    });
  });

  it("names the panda taken down or restored, and opens it only once it is public again", () => {
    const control = (action: string) =>
      message(
        { kind: "publication_control", action, resourceKind: "panda", resourceId: "p1" },
        { category: "correction" },
      );
    expect(messageView(control("restored"), names, slugs)).toEqual({
      title: "和花的资料恢复公开了",
      detail: null,
      pandaId: "p1",
      href: "/pandas/he-hua",
    });
    expect(messageView(control("taken_down"), names)).toMatchObject({
      title: "和花的资料暂时下线核对",
      pandaId: null,
      href: null,
    });
  });

  it("reads erased and unknown content as plain notices", () => {
    expect(messageView(message({ erased: true }), names).title).toBe("这条通知已清除");
    expect(messageView(message({ kind: "future" }, { category: "correction" }), names).title).toBe("资料有更正");
  });
});

describe("resolveNotificationHref", () => {
  it("allows known panda/venue/inbox routes and rejects external or unsafe routes", () => {
    expect(resolveNotificationHref({ route: "/pandas/meng-lan" })).toBe("/pandas/meng-lan");
    expect(resolveNotificationHref({ route: "/institutions/beijing-zoo" })).toBe("/institutions/beijing-zoo");
    expect(resolveNotificationHref({ route: "https://evil.example/phish", kind: "birthday_reminder", pandaSlug: "he-hua" })).toBe(
      "/pandas/he-hua",
    );
    expect(resolveNotificationHref({ route: "/pandas/../account" })).toBeNull();
    expect(resolveNotificationHref({ route: "/account" })).toBeNull();
    expect(resolveNotificationHref({ kind: "panda_news", pandaId: "p1" }, slugs)).toBe("/pandas/he-hua");
  });
});

describe("unreadCount", () => {
  it("counts messages without a read time", () => {
    expect(unreadCount([message({}), message({}, { readAt: "2026-10-26T07:00:00.000Z" })])).toBe(1);
  });
});

describe("preferenceRows", () => {
  it("keeps all 5 categories and 3 channels in fixed order", () => {
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
      preference("birthday_reminder", "push", true),
    ]);
    expect(rows.map((row) => `${row.label} ${row.enabled}`)).toEqual([
      "生日提醒，手机推送 true",
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
