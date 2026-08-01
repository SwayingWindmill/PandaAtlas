import { defineConfig, devices } from "@playwright/test";

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim()
  || (
    process.platform === "win32" && process.env.RELEASE_GATE_USE_SYSTEM_EDGE !== "0"
      ? "msedge"
      : undefined
  );
const browserMatrix = process.env.PLAYWRIGHT_BROWSER_MATRIX === "1";
const productionServer = process.env.PLAYWRIGHT_WEB_SERVER_MODE === "production"
  || process.env.npm_lifecycle_event === "smoke:production";
const port = Number(process.env.PLAYWRIGHT_PORT ?? (productionServer ? "3200" : "3100"));
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1";
const productionDistDir = process.env.PLAYWRIGHT_NEXT_DIST_DIR?.trim()
  || ".next-production-smoke";
const ci = Boolean(process.env.CI);

const projects = browserMatrix
  ? [
      { name: "chromium", use: { ...devices["Desktop Chrome"] } },
      { name: "firefox", use: { ...devices["Desktop Firefox"] } },
      { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ]
  : [
      {
        name: browserChannel ?? "chromium",
        use: {
          ...devices["Desktop Chrome"],
          ...(browserChannel ? { channel: browserChannel } : {}),
        },
      },
    ];

export default defineConfig({
  testDir: "./tests/smoke",
  workers: 1,
  outputDir: ci ? "../../.release-gate/playwright-test-results" : "test-results",
  reporter: ci
    ? [
        ["line"],
        ["json", { outputFile: "../../.release-gate/playwright-results.json" }],
        ["html", { outputFolder: "../../.release-gate/playwright-report", open: "never" }],
      ]
    : "list",
  use: {
    baseURL,
    trace: ci ? "retain-on-failure" : "off",
    screenshot: ci ? "only-on-failure" : "off",
    video: ci ? "retain-on-failure" : "off",
  },
  projects,
  webServer: externalBaseURL ? undefined : {
    command: productionServer
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/pandas`,
    reuseExistingServer,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65534",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      NEXT_PUBLIC_ENGAGEMENT_ENABLED: "true",
      NEXT_PUBLIC_FEED_ENABLED: "true",
      NEXT_PUBLIC_NOTIFICATION_ENABLED: "true",
      ...(productionServer ? { PANDA_NEXT_DIST_DIR: productionDistDir } : {}),
    },
  },
});
