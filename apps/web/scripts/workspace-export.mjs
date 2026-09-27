#!/usr/bin/env node

import { createHash } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "../../..");

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function numberArg(args, key, fallback) {
  const raw = args.get(key);
  if (raw == null) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${key} must be a positive number`);
  }
  return value;
}

async function resolveInsideWorkspace(inputPath) {
  const absolute = path.resolve(workspaceRoot, inputPath);
  const [rootReal, fileReal] = await Promise.all([
    realpath(workspaceRoot),
    realpath(absolute),
  ]);

  if (fileReal !== rootReal && !fileReal.startsWith(`${rootReal}${path.sep}`)) {
    throw new Error("Refusing to export a file outside the PandaAtlas workspace.");
  }

  const fileStat = await stat(fileReal);
  if (!fileStat.isFile()) throw new Error("Export path must point to a file.");
  return fileReal;
}

async function buildPayload(filePath, mode, maxWidth, quality) {
  if (mode === "raw") {
    const { readFile } = await import("node:fs/promises");
    const buffer = await readFile(filePath);
    return {
      buffer,
      mime: "application/octet-stream",
      extension: path.extname(filePath) || ".bin",
    };
  }

  if (mode !== "visual") {
    throw new Error("--mode must be either raw or visual");
  }

  const buffer = await sharp(filePath)
    .rotate()
    .resize({
      width: maxWidth,
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({
      quality,
      mozjpeg: true,
    })
    .toBuffer();

  return {
    buffer,
    mime: "image/jpeg",
    extension: ".jpg",
  };
}

const args = parseArgs(process.argv.slice(2));
const inputPath = args.get("path");
if (!inputPath) {
  throw new Error("Usage: node scripts/workspace-export.mjs --path <workspace-relative-file> [--mode visual|raw] [--meta] [--chunk N]");
}

const mode = args.get("mode") ?? "raw";
const chunkSize = numberArg(args, "chunk-size", 24000);
const maxWidth = numberArg(args, "max-width", 1440);
const quality = numberArg(args, "quality", 72);
const filePath = await resolveInsideWorkspace(inputPath);
const sourceStat = await stat(filePath);
const { buffer, mime, extension } = await buildPayload(filePath, mode, maxWidth, quality);
const sha256 = createHash("sha256").update(buffer).digest("hex");
const base64 = buffer.toString("base64");
const chunkCount = Math.ceil(base64.length / chunkSize);

if (args.has("meta")) {
  process.stdout.write(JSON.stringify({
    source: path.relative(workspaceRoot, filePath).replaceAll("\\", "/"),
    sourceBytes: sourceStat.size,
    exportedBytes: buffer.length,
    mime,
    extension,
    sha256,
    base64Chars: base64.length,
    chunkSize,
    chunkCount,
    mode,
    maxWidth: mode === "visual" ? maxWidth : null,
    quality: mode === "visual" ? quality : null,
  }));
  process.exit(0);
}

const chunkRaw = args.get("chunk");
if (chunkRaw == null) {
  throw new Error("Pass --meta for metadata or --chunk <zero-based-index> for payload data.");
}

const chunk = Number(chunkRaw);
if (!Number.isInteger(chunk) || chunk < 0 || chunk >= chunkCount) {
  throw new Error(`--chunk must be an integer from 0 to ${chunkCount - 1}`);
}

process.stdout.write(base64.slice(chunk * chunkSize, (chunk + 1) * chunkSize));
