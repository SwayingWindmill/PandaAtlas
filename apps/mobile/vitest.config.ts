import { defineConfig } from "vitest/config";

// Unit tests for the app's pure logic (no React Native imports); screens are covered by e2e/.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
