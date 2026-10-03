import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

// Next/webpack builds the application. Vite packages its OpenNext Worker
// and static assets into cf's Build Output; it does not build React pages.
export default defineConfig({
  plugins: [cloudflare({ types: { generate: false } })],
  publicDir: ".cloudflare/assets",
  server: { host: "127.0.0.1", port: 8788 },
});
