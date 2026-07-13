import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const loopbackHost = "127.0.0.1";
const userArgs = process.argv.slice(2);

if (!process.env.ADMIN_API_TOKEN?.trim()) {
  console.error("ADMIN_API_TOKEN must be configured before starting the local admin proxy.");
  process.exit(1);
}

if (userArgs.some((arg) => arg === "--hostname" || arg === "-H" || arg.startsWith("--hostname="))) {
  console.error("The local admin proxy hostname is fixed to 127.0.0.1 and cannot be overridden.");
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, "dev", "--hostname", loopbackHost, ...userArgs], {
  env: {
    ...process.env,
    APP_ENV: "development",
    ENABLE_LOCAL_ADMIN_PROXY: "true",
    LOCAL_ADMIN_PROXY_BIND_HOST: loopbackHost,
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (child.exitCode === null) {
      child.kill(signal);
    }
  });
}

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
