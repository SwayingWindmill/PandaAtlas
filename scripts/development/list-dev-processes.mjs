import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { repoRoot } from "./catalog.mjs";

const RUNTIME_EXECUTABLES = new Set(["node.exe", "workerd.exe"]);

// PowerShell emits one JSON document with processes and listening sockets; Node does the selection.
const SNAPSHOT_SCRIPT = `
$processes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='workerd.exe'" | ForEach-Object {
  [pscustomobject]@{
    pid = [int]$_.ProcessId
    name = $_.Name
    commandLine = $_.CommandLine
    executablePath = $_.ExecutablePath
    startedAt = if ($_.CreationDate) { $_.CreationDate.ToString('o') } else { $null }
    workingSetBytes = [int64]$_.WorkingSetSize
  }
})
$listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{ pid = [int]$_.OwningProcess; port = [int]$_.LocalPort }
})
[pscustomobject]@{ processes = $processes; listeners = $listeners } | ConvertTo-Json -Depth 4 -Compress
`;

function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/").toLowerCase();
}

export function selectDevProcesses({ processes, listeners, root, selfPid }) {
  const normalizedRoot = normalizePath(root).replace(/\/$/u, "");
  const portsByPid = new Map();
  for (const { pid, port } of listeners) {
    portsByPid.set(pid, [...new Set([...(portsByPid.get(pid) ?? []), port])].sort((a, b) => a - b));
  }

  return processes
    .filter(({ pid, name }) => pid !== selfPid && RUNTIME_EXECUTABLES.has(String(name).toLowerCase()))
    .filter(
      ({ commandLine, executablePath }) =>
        normalizePath(commandLine).includes(normalizedRoot) ||
        normalizePath(executablePath).includes(normalizedRoot),
    )
    .map(({ pid, name, commandLine, startedAt, workingSetBytes }) => ({
      pid,
      ports: portsByPid.get(pid) ?? [],
      startedAt,
      memoryMb: Math.round(Number(workingSetBytes) / 1024 / 1024),
      command: summarizeCommand(name, commandLine, normalizedRoot),
    }))
    .sort((left, right) => right.memoryMb - left.memoryMb);
}

function summarizeCommand(name, commandLine, normalizedRoot) {
  const text = String(commandLine ?? name)
    .replaceAll("\\", "/")
    .replace(new RegExp(normalizedRoot.replace(/[.*+?^${}()|[\]]/gu, "\\$&"), "giu"), ".")
    .replaceAll('"', "")
    .replace(/^\S*node(?:\.exe)?\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
}

export function formatDevProcesses(rows) {
  if (rows.length === 0) return ["[dev:processes] No PandaAtlas node/workerd processes are running."];
  const lines = [`[dev:processes] ${rows.length} PandaAtlas node/workerd process(es):`];
  for (const row of rows) {
    const started = row.startedAt ? row.startedAt.slice(0, 16).replace("T", " ") : "unknown";
    const ports = row.ports.length > 0 ? row.ports.join(",") : "-";
    lines.push(`  pid=${row.pid} ports=${ports} started=${started} memory=${row.memoryMb}MB | ${row.command}`);
  }
  return lines;
}

function readSnapshot() {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", SNAPSHOT_SCRIPT], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw new Error(`Unable to inspect processes: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Process inspection failed: ${(result.stderr ?? "").trim()}`);
  const snapshot = JSON.parse(result.stdout);
  return { processes: [snapshot.processes ?? []].flat(), listeners: [snapshot.listeners ?? []].flat() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.platform !== "win32") throw new Error("dev.processes inspects the Windows development host only.");
    const { processes, listeners } = readSnapshot();
    const rows = selectDevProcesses({ processes, listeners, root: repoRoot, selfPid: process.pid });
    for (const line of formatDevProcesses(rows)) console.log(line);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
