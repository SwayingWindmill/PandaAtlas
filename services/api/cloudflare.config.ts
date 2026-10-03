import { bindings, defineConfig } from "cf/config";

export default defineConfig(() => ({
    accountId: "b391ffba7f4fb602b01e0c1e8f893baa",
    worker: {
      name: "zhipanda-v2-api",
      entrypoint: "./worker/index.mjs",
      domains: ["api.zhipanda.com"],
      workersDev: true,
      compatibilityDate: "2026-10-01",
      compatibilityFlags: ["nodejs_compat", "enable_nodejs_http_server_modules"],
      observability: { enabled: true, redactQueryString: true },
      env: {
        APP_ENV: bindings.text("production"),
        DATABASE_CONNECTION_MODE: bindings.text("hyperdrive"),
        LOG_LEVEL: bindings.text("info"),
        CORS_ALLOW_ORIGINS: bindings.text("https://zhipanda.com,https://www.zhipanda.com,https://zhipanda-v2-web.hao1012812011.workers.dev"),
        SUPABASE_URL: bindings.text("https://gsnpkwlezpdkdupizjdb.supabase.co"),
        PUBLIC_WEB: bindings.worker({ worker: "zhipanda-v2-web" }),
        HYPERDRIVE: bindings.hyperdrive({ id: "988de17966ba42dd81bca021c134925a" }),
        PUBLIC_WEB_BASE_URL: bindings.text("https://zhipanda.com"),
        PUBLIC_REVALIDATION_AUTH: bindings.secret(),
        CRON_SECRET: bindings.secret(),
      },
    },
  }));
