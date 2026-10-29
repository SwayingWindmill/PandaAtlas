import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import vinext from "vinext";

export default defineConfig({
  // Vinext's client prebundling breaks the React hook context for this registry dependency.
  optimizeDeps: { exclude: ["react-resizable-panels"] },
  // npm nests this package under apps/web: expo-router's optional peer range rejects 19.3.1,
  // so it is not hoisted beside @vitejs/plugin-rsc. Vite then treats the import as a missing
  // optional peer and emits a top-level throw. workerd evaluates that throw while validating
  // the Worker. Dedupe resolves the package from this workspace and bundles the real module.
  resolve: { dedupe: ["react-server-dom-webpack"] },
  plugins: [
    vinext(),
    cloudflare({
      types: { generate: false },
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
  server: { host: "127.0.0.1", port: 8788 },
});
