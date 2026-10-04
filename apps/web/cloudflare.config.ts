import { bindings, defineConfig } from "cf/config";

export default defineConfig(({ mode }) => ({
  accountId: "b391ffba7f4fb602b01e0c1e8f893baa",
  worker: {
    name: "zhipanda-v2-web",
    entrypoint: "./worker/index.mjs",
    domains: ["zhipanda.com", "www.zhipanda.com"],
    workersDev: true,
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    observability: { enabled: true, redactQueryString: true },
    env: {
      ASSETS: bindings.assets(),
      HOME_MEDIA: bindings.r2({ name: "panda-atlas-media" }),
      ...(mode === "production" ? { V2_API: bindings.worker({ worker: "zhipanda-v2-api" }) } : {}),
      API_TRANSPORT: bindings.text(mode === "production" ? "service-binding" : "http"),
      API_BASE_URL: bindings.text(mode === "production" ? "https://api.zhipanda.com" : (process.env.API_BASE_URL ?? "http://localhost:3001")),
      NEXT_PUBLIC_API_BASE_URL: bindings.text(mode === "production" ? "https://api.zhipanda.com" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001")),
      NEXT_PUBLIC_ENGAGEMENT_ENABLED: bindings.text("true"),
      SITE_URL: bindings.text("https://www.zhipanda.com"),
      NEXT_PUBLIC_SITE_URL: bindings.text("https://www.zhipanda.com"),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text(mode === "production" ? "https://gsnpkwlezpdkdupizjdb.supabase.co" : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:65534")),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.text(mode === "production" ? "sb_publishable_-JoUNsIVaSHreJXJ0hrd2g_6Skn9Dmm" : (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "test-publishable-key")),
      ADMIN_SHELL_ENABLED: bindings.text(process.env.ADMIN_SHELL_ENABLED ?? "false"),
    },
  },
}));
