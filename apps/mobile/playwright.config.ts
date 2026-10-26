import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

// End-to-end journeys of the app's web build against the real local stack: Supabase Auth (codes read from
// its Mailpit inbox) and the NestJS API on the local database. Start Supabase first (npm run infra:start).

const repoRoot = path.resolve(__dirname, "../..");
const status = JSON.parse(
  execFileSync("npx", ["supabase", "status", "-o", "json", "--workdir", "infra"], { cwd: repoRoot, encoding: "utf8", shell: true }),
) as { API_URL?: string; DB_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string; MAILPIT_URL: string };
// The Data API is off locally, so status omits API_URL; Auth answers on the gateway port (infra/supabase/config.toml).
const supabaseUrl = status.API_URL ?? "http://127.0.0.1:54321";

const apiPort = 3101;
const appPort = 8792;
const appOrigin = `http://localhost:${appPort}`;
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || (process.platform === "win32" ? "msedge" : undefined);

// Supabase's local mail catcher; the tests read sign-in codes from it.
process.env.E2E_MAILPIT_URL = status.MAILPIT_URL;
// e2e/global-setup.ts seeds through the API's own modules, which read the same configuration as the API.
Object.assign(process.env, { APP_ENV: "development", DATABASE_URL: status.DB_URL, CORS_ALLOW_ORIGINS: appOrigin });

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: appOrigin,
    viewport: { width: 390, height: 844 },
    locale: "zh-CN",
    ...(browserChannel ? { channel: browserChannel } : {}),
  },
  projects: [{ name: "mobile-web", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } }],
  webServer: [
    {
      command: "npm run dev -w @zhipanda/api",
      cwd: repoRoot,
      url: `http://127.0.0.1:${apiPort}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        APP_ENV: "development",
        HOST: "127.0.0.1",
        PORT: String(apiPort),
        DATABASE_URL: status.DB_URL,
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SECRET_KEY: status.SECRET_KEY,
        CORS_ALLOW_ORIGINS: appOrigin,
      },
    },
    {
      command: `npx expo start --web --port ${appPort}`,
      cwd: __dirname,
      url: appOrigin,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        CI: "1",
        BROWSER: "none",
        EXPO_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
        EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
      },
    },
  ],
});
