import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const adminLauncher = path.join(webRoot, "scripts", "dev-local-admin.mjs");
const publicBuildGuard = path.join(webRoot, "scripts", "assert-public-admin-proxy-disabled.mjs");
const adminPath = "/api/admin/import-sources";
const placeholderToken = "[REDACTED_SECRET]";
const managedEnvironmentKeys = [
  "ADMIN_API_TOKEN",
  "APP_ENV",
  "ENABLE_LOCAL_ADMIN_PROXY",
  "LOCAL_ADMIN_PROXY_BIND_HOST",
  "NEXT_PUBLIC_API_BASE_URL",
  "NODE_ENV",
];

function listen(server, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.off("error", reject);
      resolve(server.address());
    });
  });
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function getFreePort() {
  const server = net.createServer();
  const address = await listen(server);
  await closeServer(server);
  return address.port;
}

function createEnvironment(overrides) {
  const environment = { ...process.env };
  for (const key of managedEnvironmentKeys) {
    delete environment[key];
  }
  return { ...environment, ...overrides };
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${logs.join("")}`);
    }

    try {
      await fetch(url, { signal: AbortSignal.timeout(750) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  throw new Error(`Timed out waiting for Next.js.\n${logs.join("")}`);
}

async function stopProcess(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 3_000)),
  ]);

  if (!exited) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill("SIGKILL");
    }
  }
}

async function withUpstream(run) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({
      authorization: request.headers.authorization,
      method: request.method,
      url: request.url,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ sources: ["demo.sql"] }));
  });
  const address = await listen(server);

  try {
    await run({ requests, url: `http://127.0.0.1:${address.port}` });
  } finally {
    await closeServer(server);
  }
}

async function withWebServer({ environment, serverMode = "dev", useAdminLauncher = false }, run) {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const logs = [];
  const args = useAdminLauncher
    ? [adminLauncher, "--port", String(port)]
    : [nextBin, serverMode, "--hostname", "127.0.0.1", "--port", String(port)];
  const child = spawn(process.execPath, args, {
    cwd: webRoot,
    env: createEnvironment(environment),
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  try {
    await waitForServer(`${baseUrl}${adminPath}`, child, logs);
    await run({ baseUrl, logs, port });
  } finally {
    await stopProcess(child);
  }
}

function findNonLoopbackIpv4() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (!address.internal && (address.family === "IPv4" || address.family === 4)) {
        return address.address;
      }
    }
  }
  return null;
}

async function assertJsonDetail(response, expectedStatus, expectedDetail) {
  assert.equal(response.status, expectedStatus);
  assert.deepEqual(await response.json(), { detail: expectedDetail });
}

function requestWithHost(url, host) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { headers: { Host: host } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          body: Buffer.concat(chunks).toString("utf8"),
          status: response.statusCode ?? 0,
        });
      });
    });
    request.once("error", reject);
    request.end();
  });
}

async function testDisabledByDefault(upstreamUrl) {
  await withWebServer(
    {
      environment: {
        ADMIN_API_TOKEN: placeholderToken,
        APP_ENV: "development",
        ENABLE_LOCAL_ADMIN_PROXY: "",
        LOCAL_ADMIN_PROXY_BIND_HOST: "",
        NEXT_PUBLIC_API_BASE_URL: upstreamUrl,
      },
    },
    async ({ baseUrl }) => {
      await assertJsonDetail(await fetch(`${baseUrl}${adminPath}`), 404, "Not found");
    },
  );
}

async function testRequiresLoopbackBindingDeclaration(upstreamUrl, requests) {
  await withWebServer(
    {
      environment: {
        ADMIN_API_TOKEN: placeholderToken,
        APP_ENV: "development",
        ENABLE_LOCAL_ADMIN_PROXY: "true",
        NEXT_PUBLIC_API_BASE_URL: upstreamUrl,
      },
    },
    async ({ baseUrl }) => {
      requests.length = 0;
      await assertJsonDetail(await fetch(`${baseUrl}${adminPath}`), 404, "Not found");
      assert.equal(requests.length, 0);
    },
  );
}

async function testEnabledLoopbackTopology(upstreamUrl, requests) {
  await withWebServer(
    {
      environment: {
        ADMIN_API_TOKEN: placeholderToken,
        NEXT_PUBLIC_API_BASE_URL: upstreamUrl,
      },
      useAdminLauncher: true,
    },
    async ({ baseUrl, port }) => {
      requests.length = 0;

      const allowed = await fetch(`${baseUrl}${adminPath}`);
      assert.equal(allowed.status, 200);
      assert.deepEqual(await allowed.json(), { sources: ["demo.sql"] });
      assert.equal(requests.length, 1);
      assert.equal(requests.at(-1)?.authorization, `Bearer ${placeholderToken}`);

      const beforeCrossOrigin = requests.length;
      await assertJsonDetail(
        await fetch(`${baseUrl}${adminPath}`, { headers: { Origin: "https://example.test" } }),
        403,
        "Cross-origin admin requests are not allowed",
      );
      assert.equal(requests.length, beforeCrossOrigin);

      const beforeRemoteHost = requests.length;
      const remoteHostResponse = await requestWithHost(`${baseUrl}${adminPath}`, "example.test");
      assert.equal(remoteHostResponse.status, 403);
      assert.equal(requests.length, beforeRemoteHost);

      const beforeSpoof = requests.length;
      await assertJsonDetail(
        await fetch(`${baseUrl}${adminPath}`, {
          headers: {
            Forwarded: "for=198.51.100.24;host=localhost;proto=http",
            Host: "localhost",
            Origin: `http://localhost:${port}`,
            "X-Forwarded-For": "198.51.100.24",
            "X-Forwarded-Host": "localhost",
            "X-Real-IP": "198.51.100.24",
          },
        }),
        403,
        "Forwarded admin proxy requests are not allowed",
      );
      assert.equal(requests.length, beforeSpoof);

      const nonLoopbackAddress = findNonLoopbackIpv4();
      if (nonLoopbackAddress) {
        await assert.rejects(
          fetch(`http://${nonLoopbackAddress}:${port}${adminPath}`, {
            headers: { Host: "localhost" },
            signal: AbortSignal.timeout(1_000),
          }),
        );
      }
    },
  );
}

async function testMissingToken(upstreamUrl) {
  await withWebServer(
    {
      environment: {
        APP_ENV: "development",
        ENABLE_LOCAL_ADMIN_PROXY: "true",
        LOCAL_ADMIN_PROXY_BIND_HOST: "127.0.0.1",
        NEXT_PUBLIC_API_BASE_URL: upstreamUrl,
      },
    },
    async ({ baseUrl }) => {
      await assertJsonDetail(
        await fetch(`${baseUrl}${adminPath}`),
        503,
        "ADMIN_API_TOKEN is not configured for the web admin proxy",
      );
    },
  );
}

async function testPublicEnvironmentStaysDisabled(upstreamUrl, requests) {
  await withWebServer(
    {
      environment: {
        ADMIN_API_TOKEN: placeholderToken,
        APP_ENV: "production",
        ENABLE_LOCAL_ADMIN_PROXY: "true",
        LOCAL_ADMIN_PROXY_BIND_HOST: "127.0.0.1",
        NEXT_PUBLIC_API_BASE_URL: upstreamUrl,
      },
    },
    async ({ baseUrl }) => {
      requests.length = 0;
      await assertJsonDetail(await fetch(`${baseUrl}${adminPath}`), 404, "Not found");
      assert.equal(requests.length, 0);
    },
  );
}

async function testProductionBuildStaysDisabled(upstreamUrl, requests) {
  await withWebServer(
    {
      environment: {
        ADMIN_API_TOKEN: placeholderToken,
        APP_ENV: "development",
        ENABLE_LOCAL_ADMIN_PROXY: "true",
        LOCAL_ADMIN_PROXY_BIND_HOST: "127.0.0.1",
        NEXT_PUBLIC_API_BASE_URL: upstreamUrl,
        NODE_ENV: "production",
      },
      serverMode: "start",
    },
    async ({ baseUrl }) => {
      requests.length = 0;
      await assertJsonDetail(await fetch(`${baseUrl}${adminPath}`), 404, "Not found");
      assert.equal(requests.length, 0);
    },
  );
}

function testAdminLauncherRejectsHostnameOverride() {
  const result = spawnSync(process.execPath, [adminLauncher, "--hostname", "0.0.0.0"], {
    cwd: webRoot,
    encoding: "utf8",
    env: createEnvironment({ ADMIN_API_TOKEN: placeholderToken }),
  });
  assert.notEqual(result.status, 0);
}

function testPublicBuildGuard() {
  const allowed = spawnSync(process.execPath, [publicBuildGuard], {
    cwd: webRoot,
    encoding: "utf8",
    env: createEnvironment({}),
  });
  assert.equal(allowed.status, 0, allowed.stderr);

  const backendTokenOnly = spawnSync(process.execPath, [publicBuildGuard], {
    cwd: webRoot,
    encoding: "utf8",
    env: createEnvironment({ ADMIN_API_TOKEN: placeholderToken }),
  });
  assert.equal(backendTokenOnly.status, 0, backendTokenOnly.stderr);

  for (const unsafeEnvironment of [
    { ENABLE_LOCAL_ADMIN_PROXY: "true" },
    { LOCAL_ADMIN_PROXY_BIND_HOST: "127.0.0.1" },
  ]) {
    const denied = spawnSync(process.execPath, [publicBuildGuard], {
      cwd: webRoot,
      encoding: "utf8",
      env: createEnvironment(unsafeEnvironment),
    });
    assert.notEqual(denied.status, 0);
  }
}

async function main() {
  if (process.argv.includes("--production")) {
    await withUpstream(async ({ requests, url }) => {
      await testProductionBuildStaysDisabled(url, requests);
    });
    return;
  }

  testAdminLauncherRejectsHostnameOverride();
  testPublicBuildGuard();
  await withUpstream(async ({ requests, url }) => {
    await testDisabledByDefault(url);
    await testRequiresLoopbackBindingDeclaration(url, requests);
    await testEnabledLoopbackTopology(url, requests);
    await testMissingToken(url);
    await testPublicEnvironmentStaysDisabled(url, requests);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
