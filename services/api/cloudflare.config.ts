import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig(() => ({
    accountId: "b391ffba7f4fb602b01e0c1e8f893baa",
    worker: {
      name: "zhipanda-v2-api",
      entrypoint: "./worker/index.mjs",
      domains: ["api.zhipanda.com"],
      triggers: [triggers.scheduled({ schedule: "*/5 * * * *" })],
      workersDev: false,
      // Run next to the only back end: Supabase Postgres in AWS ap-northeast-1 (Tokyo).
      placement: { region: "aws:ap-northeast-1" },
      compatibilityDate: "2026-10-01",
      compatibilityFlags: ["nodejs_compat", "enable_nodejs_http_server_modules"],
      observability: { enabled: true, redactQueryString: true },
      env: {
        APP_ENV: bindings.text("production"),
        DATABASE_CONNECTION_MODE: bindings.text("hyperdrive"),
        LOG_LEVEL: bindings.text("info"),
        CORS_ALLOW_ORIGINS: bindings.text("https://zhipanda.com,https://www.zhipanda.com"),
        SUPABASE_URL: bindings.text("https://gsnpkwlezpdkdupizjdb.supabase.co"),
        // ctx.props on this binding is what authorizes the Web Worker to purge its public page cache.
        PUBLIC_WEB: bindings.worker({ worker: "zhipanda-v2-web", props: { publicCachePurge: true } }),
        HYPERDRIVE: bindings.hyperdrive({ id: "988de17966ba42dd81bca021c134925a" }),
      },
    },
  }));
