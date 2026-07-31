import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_ADMIN_PORT ?? "3300");
const baseURL = `http://127.0.0.1:${port}`;
const browserChannel =
  process.platform === "win32" && process.env.RELEASE_GATE_USE_SYSTEM_EDGE !== "0"
    ? "msedge"
    : undefined;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/admin",
  workers: 1,
  outputDir: ci ? "../../.release-gate/admin-playwright-test-results" : "test-results/admin",
  reporter: ci
    ? [
        ["line"],
        ["json", { outputFile: "../../.release-gate/admin-playwright-results.json" }],
        ["html", { outputFolder: "../../.release-gate/admin-playwright-report", open: "never" }],
      ]
    : "line",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    ...(browserChannel ? { channel: browserChannel } : {}),
    trace: ci ? "retain-on-failure" : "off",
    screenshot: ci ? "only-on-failure" : "off",
    video: ci ? "retain-on-failure" : "off",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/auth/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      PANDA_NEXT_DIST_DIR: ".next-admin-playwright",
      ADMIN_SHELL_ENABLED: "true",
      NEXT_PUBLIC_ADMIN_SHELL_ENABLED: "true",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
    },
  },
});
