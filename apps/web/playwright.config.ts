import { defineConfig, devices } from "@playwright/test";

const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || undefined;
const productionServer = process.env.PLAYWRIGHT_WEB_SERVER_MODE === "production";
const port = Number(process.env.PLAYWRIGHT_PORT ?? "3000");
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === undefined
    ? true
    : process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1";

export default defineConfig({
  testDir: "./tests/smoke",
  use: {
    baseURL,
  },
  projects: [
    {
      name: browserChannel ?? "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  webServer: externalBaseURL ? undefined : {
    command: productionServer
      ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
      : `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/atlas`,
    reuseExistingServer,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
    },
  },
});
