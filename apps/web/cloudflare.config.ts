import { bindings, defineConfig, exports } from "cf/config";

export default defineConfig(() => ({
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
      V2_API: bindings.worker({ worker: "zhipanda-v2-api" }),
      API_TRANSPORT: bindings.text("service-binding"),
      WORKER_SELF_REFERENCE: bindings.worker({ worker: "zhipanda-v2-web" }),
      NEXT_INC_CACHE_R2_BUCKET: bindings.r2({ name: "zhipanda-v2-web-cache" }),
      NEXT_CACHE_DO_QUEUE: bindings.durableObject({ worker: "zhipanda-v2-web", exportName: "DOQueueHandler" }),
      NEXT_TAG_CACHE_DO_SHARDED: bindings.durableObject({ worker: "zhipanda-v2-web", exportName: "DOShardedTagCache" }),
      API_BASE_URL: bindings.text("https://api.zhipanda.com"),
      NEXT_PUBLIC_API_BASE_URL: bindings.text("https://api.zhipanda.com"),
      NEXT_PUBLIC_ENGAGEMENT_ENABLED: bindings.text("true"),
      SITE_URL: bindings.text("https://www.zhipanda.com"),
      NEXT_PUBLIC_SITE_URL: bindings.text("https://www.zhipanda.com"),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text("https://gsnpkwlezpdkdupizjdb.supabase.co"),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.text("sb_publishable_-JoUNsIVaSHreJXJ0hrd2g_6Skn9Dmm"),
      PUBLIC_REVALIDATION_AUTH: bindings.secret(),
    },
    exports: {
      DOQueueHandler: exports.durableObject({ storage: "sqlite" }),
      DOShardedTagCache: exports.durableObject({ storage: "sqlite" }),
    },
  },
}));
