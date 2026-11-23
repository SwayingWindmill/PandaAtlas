import { describe, expect, it } from "vitest";

import { feedbackMailto, versionLabel } from "./app-info";

const app = { version: "0.1.0", build: "42", os: "ios", osVersion: "18.2" };

describe("versionLabel", () => {
  it("puts the build number after the version", () => {
    expect(versionLabel(app)).toBe("0.1.0 (42)");
  });

  it("shows the version alone when there is no build number", () => {
    expect(versionLabel({ ...app, build: null })).toBe("0.1.0");
  });
});

describe("feedbackMailto", () => {
  it("addresses hello@zhipanda.com with the version and system in the body", () => {
    const url = new URL(feedbackMailto(app));
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("hello@zhipanda.com");
    expect(url.searchParams.get("subject")).toBe("吱熊猫反馈");
    expect(url.searchParams.get("body")).toContain("App 版本：0.1.0 (42)");
    expect(url.searchParams.get("body")).toContain("系统：ios 18.2");
  });
});
