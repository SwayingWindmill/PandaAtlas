import { defineConfig } from "@playwright/test";

import baseConfig from "./playwright.config";

export default defineConfig(baseConfig, {
  testDir: "./tests/accessibility",
  reporter: [
    ["line"],
    ["json", { outputFile: "../../.release-gate/accessibility-automated.json" }],
  ],
});
