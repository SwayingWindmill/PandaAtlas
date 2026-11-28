import { describe, expect, it } from "vitest";

import { appPathForLink } from "./web-links";

describe("appPathForLink", () => {
  it("drops the web's locale from a panda, venue or place link", () => {
    expect(appPathForLink("https://www.zhipanda.com/zh/pandas/a-bao")).toBe("/pandas/a-bao");
    expect(appPathForLink("https://www.zhipanda.com/en/institutions/zoo-atlanta/")).toBe("/institutions/zoo-atlanta");
    expect(appPathForLink("https://www.zhipanda.com/zh/places/chengdu?ref=share")).toBe("/places/chengdu");
  });

  it("leaves the app's own scheme links and other paths alone", () => {
    expect(appPathForLink("zhipanda://pandas/a-bao")).toBe("zhipanda://pandas/a-bao");
    expect(appPathForLink("/pandas/a-bao")).toBe("/pandas/a-bao");
    expect(appPathForLink("https://www.zhipanda.com/zh/me")).toBe("https://www.zhipanda.com/zh/me");
    expect(appPathForLink("https://example.org/zh/pandas/a-bao")).toBe("https://example.org/zh/pandas/a-bao");
  });
});
