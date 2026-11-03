import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ authedApi: {} }));

const { appHref, canSend, cleanQuestion, closesToday, questionLength, QUESTION_LIMIT, referenceUrl, sourceDetail } = await import("./ask");

describe("问问熊猫", () => {
  it("cleans a question the way the API does", () => {
    expect(cleanQuestion("  大熊猫\u200B  吃 \n 什么？ ")).toBe("大熊猫 吃 什么?");
  });

  it("counts characters, not UTF-16 units", () => {
    expect(questionLength("🐼🐼")).toBe(2);
  });

  it("sends only a non-empty question within the limit", () => {
    expect(canSend("   ")).toBe(false);
    expect(canSend("熊".repeat(QUESTION_LIMIT))).toBe(true);
    expect(canSend("熊".repeat(QUESTION_LIMIT + 1))).toBe(false);
  });

  it("opens only pages the app has", () => {
    expect(appHref("/learn")).toBe("/learn");
    expect(appHref("/learn/articles/bamboo")).toBe("/learn/articles/bamboo");
    expect(appHref("/learn/faces/bao-li")).toBe("/learn/faces/bao-li");
    expect(appHref("/pandas/mei-xiang")).toBe("/pandas/mei-xiang");
    expect(appHref("/settings")).toBeNull();
    expect(appHref("https://example.com")).toBeNull();
    expect(appHref("/pandas/../settings")).toBeNull();
  });

  it("links references over https only", () => {
    expect(referenceUrl("https://nationalzoo.si.edu/animals/giant-panda")).toBe("https://nationalzoo.si.edu/animals/giant-panda");
    expect(referenceUrl("http://example.com")).toBeNull();
    expect(referenceUrl("javascript:alert(1)")).toBeNull();
    expect(referenceUrl("not a url")).toBeNull();
  });

  it("closes the composer only for what lasts the day", () => {
    expect(closesToday("quotaExhausted")).toBe(true);
    expect(closesToday("dailyCap")).toBe(true);
    expect(closesToday("rateLimited")).toBe(false);
    expect(closesToday("failed")).toBe(false);
  });

  it("names a source by its publishers, or by what kind of page it is", () => {
    const ref = (publisher: string) => ({ title: "t", publisher, url: "https://example.org" });
    expect(sourceDetail({ kind: "article", title: "a", appPath: "/learn/articles/a", references: [ref("WWF"), ref("WWF"), ref("成都大熊猫繁育研究基地")] })).toBe("WWF · 成都大熊猫繁育研究基地");
    expect(sourceDetail({ kind: "faceGuide", title: "宝力", appPath: "/learn/faces/bao-li", references: [] })).toBe("认脸指南");
  });
});
