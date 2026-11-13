// The app's web build against production's public data, for checking a screen with real content.
// Production's API only sends CORS headers to its own origins, so a local proxy on 8797 forwards
// GET and HEAD and adds them; anything that writes is refused. Expo serves the app on 8796 and
// reloads as files change. Ctrl-C (or killing this process) stops both.
//   node apps/mobile/scripts/preview-production.mjs
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";

const PROXY_PORT = 8797;
const APP_PORT = 8796;
const UPSTREAM = "https://api.zhipanda.com";
const mobileRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(mobileRoot, "../..");

const proxy = http
  .createServer(async (req, res) => {
    const cors = {
      "access-control-allow-origin": req.headers.origin ?? "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,HEAD,OPTIONS",
    };
    if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
    if (req.method !== "GET" && req.method !== "HEAD") return res.writeHead(405, cors).end("read-only preview");
    try {
      const upstream = await fetch(UPSTREAM + req.url, { headers: { accept: req.headers.accept ?? "*/*" } });
      const body = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, { ...cors, "content-type": upstream.headers.get("content-type") ?? "application/octet-stream" });
      res.end(body);
    } catch (error) {
      res.writeHead(502, cors).end(String(error));
    }
  })
  .listen(PROXY_PORT, "127.0.0.1");

const expo = spawn(process.execPath, [path.join(repoRoot, "node_modules/expo/bin/cli"), "start", "--web", "--port", String(APP_PORT)], {
  cwd: mobileRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    BROWSER: "none",
    EXPO_PUBLIC_API_BASE_URL: `http://localhost:${PROXY_PORT}`,
    EXPO_PUBLIC_MEDIA_BASE_URL: `${UPSTREAM}/media`,
  },
});

function stop(code) {
  proxy.close();
  // Expo starts its own workers; on Windows only taskkill /T reaches them.
  if (process.platform === "win32" && expo.exitCode === null) spawn("taskkill", ["/pid", String(expo.pid), "/T", "/F"], { stdio: "ignore" });
  else expo.kill("SIGTERM");
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => stop(0));
expo.on("exit", (code) => stop(code ?? 0));
console.log(`[preview] proxy on http://127.0.0.1:${PROXY_PORT} -> ${UPSTREAM}; app on http://localhost:${APP_PORT}`);
