import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the app's pure logic (no React Native imports); screens are covered by e2e/.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
