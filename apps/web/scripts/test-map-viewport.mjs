import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.resolve(
  scriptDirectory,
  "../features/map/visualization/map-viewport-domain.ts",
);
const source = await readFile(modulePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: modulePath,
});

const encodedModule = Buffer.from(transpiled.outputText).toString("base64");
const viewportModule = await import(`data:text/javascript;base64,${encodedModule}`);
const {
  canonicalMapViewport,
  canonicalMapViewportValue,
  defaultMapViewport,
  parseMapViewport,
  serializeMapViewport,
} = viewportModule;

assert.deepEqual(defaultMapViewport("institutions"), {
  longitude: 17,
  latitude: 32,
  zoom: 2.15,
});
assert.deepEqual(defaultMapViewport("wild"), {
  longitude: 104.2,
  latitude: 31.1,
  zoom: 5.1,
});
assert.deepEqual(
  canonicalMapViewport({ longitude: 181, latitude: -90, zoom: 20 }),
  { longitude: 180, latitude: -85, zoom: 12 },
);
assert.deepEqual(
  parseMapViewport("-77.049123,38.929456,7.126", "institutions"),
  { longitude: -77.0491, latitude: 38.9295, zoom: 7.13 },
);
assert.deepEqual(
  parseMapViewport("invalid", "wild"),
  defaultMapViewport("wild"),
);
assert.equal(
  serializeMapViewport({ longitude: -77.049123, latitude: 38.929456, zoom: 7.126 }),
  "-77.0491,38.9295,7.13",
);
assert.equal(
  canonicalMapViewportValue("-77.049123,38.929456,7.126", "institutions"),
  "-77.0491,38.9295,7.13",
);
assert.equal(canonicalMapViewportValue("", "institutions"), "");
