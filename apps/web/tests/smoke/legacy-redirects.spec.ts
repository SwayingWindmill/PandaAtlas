import { expect, test } from "@playwright/test";

// Retired public URLs, answered by the proxy before any route renders. Unlocalized paths follow the
// request language; every redirect keeps the query string.
const LEGACY_REDIRECTS: Array<[legacy: string, destination: string]> = [
  ["/pandas", "/en/pandas"],
  ["/atlas?q=mei", "/en/pandas?q=mei"],
  ["/zh/atlas?q=mei", "/zh/pandas?q=mei"],
  ["/my-pandas", "/en/me"],
  ["/me/passport", "/en/me"],
  ["/zh/my-pandas", "/zh/me"],
  ["/zh/me/passport", "/zh/me"],
  ["/map?mode=individual&focus=mei-xiang", "/en/map?mode=individual&focus=mei-xiang"],
  ["/global-distribution?mode=individual&focus=mei-xiang", "/en/map?mode=individual&focus=mei-xiang"],
];

test("legacy public URLs redirect permanently to their canonical route", async ({ request }) => {
  for (const [legacy, destination] of LEGACY_REDIRECTS) {
    const response = await request.get(legacy, {
      headers: { "accept-language": "en-US,en;q=0.9" },
      maxRedirects: 0,
    });

    expect(response.status(), legacy).toBe(308);
    const location = new URL(response.headers().location, "http://localhost");
    expect(location.pathname + location.search, legacy).toBe(destination);
  }
});
