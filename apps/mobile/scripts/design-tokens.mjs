#!/usr/bin/env node
// Writes the generated blocks of src/global.css and the repo's DESIGN.md front matter from
// src/design/tokens.ts. `--check` exits 1 instead of writing when either file is stale.
// Needs Node 22.18+ (TypeScript type stripping).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { applyCssBlock, applyFrontMatter } from "../src/design/generate.ts";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  [resolve(app, "src/global.css"), applyCssBlock],
  [resolve(app, "../../DESIGN.md"), applyFrontMatter],
];
const check = process.argv.includes("--check");

let stale = 0;
for (const [file, apply] of targets) {
  const current = readFileSync(file, "utf8");
  const next = apply(current);
  if (next === current) continue;
  stale += 1;
  if (check) console.error(`${file} is out of date. Run: npm run design:tokens -w @zhipanda/mobile`);
  else {
    writeFileSync(file, next);
    console.log(`wrote ${file}`);
  }
}
if (check && stale) process.exit(1);
if (!stale) console.log("design tokens are in sync");
