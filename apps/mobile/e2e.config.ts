import { web } from "@e2e-dev/web";
import type { E2EConfig } from "e2e";

// End-to-end journeys of the app's web build against the real local stack: Supabase Auth (codes read from its
// Mailpit inbox) and the NestJS API on the local database, with fixture data tests/support/stack.ts publishes.
// Start Supabase first (npm run infra:start), then: npm run test:e2e -w @zhipanda/mobile
//
// The journeys are deterministic: locators and exact values, no agent steps, so they need no model and cost
// nothing to run. An agent goal is for a flow whose scripted steps keep breaking; it needs a model under
// `agents` and that provider's key.

export default {
  tests: ["tests/**/*.e2e.ts"],
  targets: [
    {
      name: "mobile-web",
      engine: web({
        viewport: { width: 390, height: 844 },
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        // 外观 checks that 深色 changes the screen's colours against a light system theme.
        colorScheme: "light",
      }),
      app: {
        url: "http://localhost:8792",
        command: {
          executable: "node",
          args: ["tests/support/stack.ts", "{port}"],
          log: ".e2e/logs/stack.log",
          // It builds the API, seeds the database and bundles the app before the URL answers.
          startupTimeout: 600_000,
        },
      },
    },
  ],
  // The journeys share one local database and the scheduled async cycle, so they run one file at a time.
  workers: 1,
} satisfies E2EConfig;
