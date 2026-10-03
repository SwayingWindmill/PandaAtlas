import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const packageRoot = path.dirname(require.resolve("maplibre-gl/package.json"));
const source = path.join(packageRoot, "dist", "maplibre-gl-csp-worker.js");
const destination = path.join(webRoot, "public", "maplibre", "maplibre-gl-csp-worker.js");

const sourceBytes = readFileSync(source);
let destinationBytes = null;
try {
  destinationBytes = readFileSync(destination);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

if (!destinationBytes?.equals(sourceBytes)) {
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, sourceBytes);
}
