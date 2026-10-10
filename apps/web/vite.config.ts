import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import vinext from "vinext";

export default defineConfig({
  // Vinext's client prebundling breaks the React hook context for this registry dependency.
  optimizeDeps: { exclude: ["react-resizable-panels"] },
  plugins: [
    vinext(),
    cloudflare({
      types: { generate: false },
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
  server: { host: "127.0.0.1", port: 8788 },
});
