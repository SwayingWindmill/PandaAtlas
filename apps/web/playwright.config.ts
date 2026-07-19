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
  use: {
    baseURL,
  },
  projects,
  webServer: externalBaseURL ? undefined : {
    command: productionServer
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/atlas`,
    reuseExistingServer,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
      ...(productionServer ? { PANDA_NEXT_DIST_DIR: productionDistDir } : {}),
    },
  },
});
