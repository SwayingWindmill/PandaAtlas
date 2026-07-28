import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_ADMIN_PORT ?? "3300");
const baseURL = `http://127.0.0.1:${port}`;
const browserChannel =
  process.platform === "win32" && process.env.RELEASE_GATE_USE_SYSTEM_EDGE !== "0"
    ? "msedge"
    : undefined;

export default defineConfig({
  testDir: "./tests/admin",
  workers: 1,
  reporter: "line",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    ...(browserChannel ? { channel: browserChannel } : {}),
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/auth/login`,
    reuseExistingServer: false,
    env: {
      ...process.env,
      ADMIN_SHELL_ENABLED: "true",
      NEXT_PUBLIC_ADMIN_SHELL_ENABLED: "true",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
    },
  },
});
