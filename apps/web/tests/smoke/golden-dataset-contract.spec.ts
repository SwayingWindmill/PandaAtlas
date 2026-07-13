import { expect, test } from "@playwright/test";

import { loadGoldenDatasetForBrowserTests } from "../fixtures/golden-dataset";

test("browser journeys load the canonical Mei Xiang family fixture", () => {
  const dataset = loadGoldenDatasetForBrowserTests();

  expect(dataset.dataset.id).toBe("mei-xiang-family");
  expect(dataset.dataset.version).toBe("2026.07.13.1");
  expect(dataset.dataset.fixture_consumers).toContain("browser");
  expect(dataset.pandas.map((record) => record.public.canonical_slug)).toEqual([
    "mei-xiang",
    "tian-tian",
    "tai-shan",
    "bao-bao",
    "bei-bei",
    "xiao-qi-ji",
    "bao-li",
  ]);
});
