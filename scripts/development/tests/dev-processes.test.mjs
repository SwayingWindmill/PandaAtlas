import assert from "node:assert/strict";
import test from "node:test";

import { formatDevProcesses, selectDevProcesses } from "../list-dev-processes.mjs";

const root = "E:\\Code\\PandaAtlas\\";
const processes = [
  {
    pid: 31324,
    name: "node.exe",
    commandLine: '"node" "E:\\Code\\PandaAtlas\\node_modules\\.bin\\..\\vite\\bin\\vite.js" --host 127.0.0.1 --port 3400',
    executablePath: "D:\\nvm\\node.exe",
    startedAt: "2026-10-10T16:03:39.000+08:00",
    workingSetBytes: 1540 * 1024 * 1024,
  },
  {
    pid: 20228,
    name: "workerd.exe",
    commandLine: "workerd.exe serve --binary",
    executablePath: "E:\\Code\\PandaAtlas\\node_modules\\@cloudflare\\workerd-windows-64\\bin\\workerd.exe",
    startedAt: "2026-10-10T16:04:06.000+08:00",
    workingSetBytes: 515 * 1024 * 1024,
  },
  {
    pid: 777,
    name: "node.exe",
    commandLine: '"node" "E:\\Code\\HVAC_web\\node_modules\\vite\\bin\\vite.js"',
    executablePath: "D:\\nvm\\node.exe",
    startedAt: "2026-10-12T09:00:00.000+08:00",
    workingSetBytes: 300 * 1024 * 1024,
  },
  {
    pid: 4242,
    name: "node.exe",
    commandLine: '"node" E:\\Code\\PandaAtlas\\scripts\\development\\list-dev-processes.mjs',
    executablePath: "D:\\nvm\\node.exe",
    startedAt: "2026-10-12T15:00:00.000+08:00",
    workingSetBytes: 40 * 1024 * 1024,
  },
];
const listeners = [
  { pid: 31324, port: 3400 },
  { pid: 31324, port: 3400 },
  { pid: 20228, port: 64175 },
  { pid: 777, port: 5173 },
];

test("selects only PandaAtlas node and workerd processes, excluding itself", () => {
  const rows = selectDevProcesses({ processes, listeners, root, selfPid: 4242 });
  assert.deepEqual(rows.map((row) => row.pid), [31324, 20228]);
  assert.deepEqual(rows[0].ports, [3400]);
  assert.equal(rows[0].memoryMb, 1540);
  assert.equal(rows[0].command, "./node_modules/.bin/../vite/bin/vite.js --host 127.0.0.1 --port 3400");
});

test("formats processes with port, start time and memory", () => {
  const lines = formatDevProcesses(selectDevProcesses({ processes, listeners, root, selfPid: 4242 }));
  assert.equal(lines[0], "[dev:processes] 2 PandaAtlas node/workerd process(es):");
  assert.match(lines[1], /^ {2}pid=31324 ports=3400 started=2026-10-10 16:03 memory=1540MB \| /);
  assert.equal(formatDevProcesses([])[0], "[dev:processes] No PandaAtlas node/workerd processes are running.");
});
