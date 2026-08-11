import { expect, test } from "@playwright/test";

test("localized panda profile emits canonical Schema.org structured data", async ({ page }) => {
  await page.goto("/en/pandas/mei-xiang");
  const script = page.getByTestId("panda-structured-data");
  await expect(script).toHaveAttribute("type", "application/ld+json");
  const payload = JSON.parse(await script.textContent() ?? "{}") as Record<string, unknown>;

  expect(payload["@context"]).toBe("https://schema.org");
  expect(payload["@type"]).toBe("Thing");
  expect(payload.url).toBe("https://www.zhipanda.com/en/pandas/mei-xiang");
  expect(payload.name).toBe("Mei Xiang");
  expect(payload.identifier).toEqual(expect.objectContaining({
    "@type": "PropertyValue",
    propertyID: "ZhiPanda stable panda ID",
  }));
});
