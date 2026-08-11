import { defineConfig, devices } from "@playwright/test";

const localhostNoProxy = "127.0.0.1,localhost";
process.env.NO_PROXY = [localhostNoProxy, process.env.NO_PROXY].filter(Boolean).join(",");
process.env.no_proxy = [localhostNoProxy, process.env.no_proxy].filter(Boolean).join(",");

const productionServer = process.env.PLAYWRIGHT_WEB_SERVER_MODE === "production";
const port = Number(process.env.PLAYWRIGHT_ADMIN_PORT ?? "3300");
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1";
const productionDistDir = process.env.PLAYWRIGHT_NEXT_DIST_DIR?.trim() || ".next";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim()
  || (
    process.platform === "win32" && process.env.RELEASE_GATE_USE_SYSTEM_EDGE !== "0"
      ? "msedge"
      : undefined
  );
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/admin",
  workers: 1,
  timeout: 90_000,
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
  webServer: externalBaseURL
    ? undefined
    : {
        command: productionServer
          ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
          : `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: `${baseURL}/auth/login`,
        timeout: 180_000,
        reuseExistingServer,
        env: {
          ...process.env,
          PANDA_NEXT_DIST_DIR: productionServer ? productionDistDir : ".next-admin-playwright",
          ADMIN_SHELL_ENABLED: "true",
          NEXT_PUBLIC_ADMIN_SHELL_ENABLED: "true",
          NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
        },
      },
});
