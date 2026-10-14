import { expect, test } from "@playwright/test";

const ENGLISH = "en-US,en;q=0.9";
const CHINESE = "zh-CN,zh;q=0.9";

// Unprefixed paths and retired aliases, answered by the proxy before any route renders. Unprefixed
// paths follow the request language; every redirect keeps the query string.
const LEGACY_REDIRECTS: Array<[legacy: string, acceptLanguage: string, destination: string]> = [
  ["/", ENGLISH, "/en"],
  ["/", CHINESE, "/zh"],
  ["/pandas", ENGLISH, "/en/pandas"],
  ["/atlas?q=%E7%BE%8E%E9%A6%99", ENGLISH, "/en/pandas?q=%E7%BE%8E%E9%A6%99"],
  ["/atlas?q=mei", CHINESE, "/zh/pandas?q=mei"],
  ["/zh/atlas?q=mei", ENGLISH, "/zh/pandas?q=mei"],
  ["/en/atlas", CHINESE, "/en/pandas"],
  ["/my-pandas", ENGLISH, "/en/me"],
  ["/me/passport", CHINESE, "/zh/me"],
  ["/zh/my-pandas", ENGLISH, "/zh/me"],
  ["/en/my-pandas", CHINESE, "/en/me"],
  ["/zh/me/passport", ENGLISH, "/zh/me"],
  ["/en/me/passport", CHINESE, "/en/me"],
  ["/map?mode=individual&focus=mei-xiang", ENGLISH, "/en/map?mode=individual&focus=mei-xiang"],
  ["/global-distribution?mode=individual&focus=mei-xiang", ENGLISH, "/en/map?mode=individual&focus=mei-xiang"],
  ["/atlas/meixiang?from=legacy", ENGLISH, "/en/pandas/meixiang?from=legacy"],
  ["/pandas/meixiang", CHINESE, "/zh/pandas/meixiang"],
  ["/zh/atlas/meixiang", ENGLISH, "/zh/pandas/meixiang"],
  ["/places/beijing-zoo", ENGLISH, "/en/places/beijing-zoo"],
  ["/institutions/beijing-zoo", CHINESE, "/zh/institutions/beijing-zoo"],
];

test("legacy public URLs redirect permanently to their canonical route", async ({ request }) => {
  for (const [legacy, acceptLanguage, destination] of LEGACY_REDIRECTS) {
    const response = await request.get(legacy, {
      headers: { "accept-language": acceptLanguage },
      maxRedirects: 0,
    });

    expect(response.status(), legacy).toBe(308);
    const location = new URL(response.headers().location, "http://localhost");
    expect(location.pathname + location.search, `${legacy} (${acceptLanguage})`).toBe(destination);
  }
});
