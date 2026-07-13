import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.resolve(scriptDirectory, "../components/atlas/map-viewport.ts");
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
const { createMapViewport, mapViewportEquals, mapViewportToQuery } = viewportModule;

const viewport = createMapViewport(
  {
    east: 110.9876549,
    north: 36.1234567,
    south: 25.7654321,
    west: 100.1234567,
  },
  6.8,
);

assert.deepEqual(viewport, {
  bbox: [100.12346, 25.76543, 110.98765, 36.12346],
  zoom: 6,
});
assert.deepEqual(mapViewportToQuery(viewport), {
  bbox: "100.12346,25.76543,110.98765,36.12346",
  zoom: 6,
});
assert.equal(
  mapViewportEquals(
    viewport,
    createMapViewport(
      {
        east: 110.98765491,
        north: 36.12345671,
        south: 25.76543209,
        west: 100.12345669,
      },
      6.81,
    ),
  ),
  true,
);
assert.equal(
  mapViewportEquals(
    viewport,
    createMapViewport(
      {
        east: 111.5,
        north: 36.1234567,
        south: 25.7654321,
        west: 100.1234567,
      },
      6.8,
    ),
  ),
  false,
);
assert.throws(
  () => createMapViewport({ east: 100, north: 36, south: 25, west: 100 }, 6),
  /valid map bounds/,
);
