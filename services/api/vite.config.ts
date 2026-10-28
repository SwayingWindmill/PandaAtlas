import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [cloudflare({ types: { generate: false } })],
  server: { host: "127.0.0.1", port: 8787 },
  build: {
    target: "es2023",
    rolldownOptions: {
      external: [
        "@nestjs/websockets/socket-module",
        "@nestjs/microservices",
        "@nestjs/microservices/microservices-module",
        "class-transformer/storage",
      ],
      plugins: [
        {
          name: "worker-create-require-path",
          renderChunk(code) {
            // Nest 12 evaluates createRequire(import.meta.url) while Swagger loads.
            // Workerd leaves import.meta.url undefined in these chunks.
            if (!code.includes("createRequire(import.meta.url)")) return null;
            return code.replaceAll("createRequire(import.meta.url)", 'createRequire("/worker.mjs")');
          },
        },
      ],
      output: {
        banner: 'import { createRequire as workerCreateRequire } from "node:module"; const require = workerCreateRequire("/worker.mjs");',
      },
    },
  },
});
