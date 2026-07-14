import { readFileSync } from "node:fs";
import path from "node:path";

export interface GoldenPandaFixture {
  id: string;
  publication_status: "published" | "draft" | "restricted";
  public: {
    canonical_slug: string;
    legacy_slugs?: Array<{ value: string }>;
    record_tier?: "complete_first_pass" | "identity_first_pass" | "dependency_stub";
    names: Array<{ language: string; value: string }>;
  };
  restricted: Record<string, unknown>;
}

export interface GoldenDatasetFixture {
  dataset: {
    id: string;
    version: string;
    fixture_consumers: string[];
  };
  pandas: GoldenPandaFixture[];
}

const datasetPath = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "contracts",
  "golden-dataset",
  "mei-xiang-family.v1.json",
);

export function loadGoldenDatasetForBrowserTests(): GoldenDatasetFixture {
  return JSON.parse(readFileSync(datasetPath, "utf8")) as GoldenDatasetFixture;
}
