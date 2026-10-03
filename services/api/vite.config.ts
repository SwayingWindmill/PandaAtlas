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
      output: {
        banner: 'import { createRequire as workerCreateRequire } from "node:module"; const require = workerCreateRequire("/worker.mjs");',
      },
    },
  },
});
