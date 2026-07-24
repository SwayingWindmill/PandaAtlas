import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDirectory, "..");
const appRoot = join(webRoot, "app");
const featuresRoot = join(webRoot, "features");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const entrypointExtensions = [".ts", ".tsx", ".js", ".mjs"];
const entrypointCache = new Map();

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (sourceExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function hasFeatureEntrypoint(featureName) {
  if (!entrypointCache.has(featureName)) {
    entrypointCache.set(
      featureName,
      Promise.all(
        entrypointExtensions.map((extension) => exists(join(featuresRoot, featureName, `index${extension}`))),
      ).then((results) => results.some(Boolean)),
    );
  }
  return entrypointCache.get(featureName);
}

function scriptKindFor(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js") || file.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function featureImports(file, content) {
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  const imports = [];

  function record(node, moduleSpecifier) {
    if (!moduleSpecifier.startsWith("@/features/")) return;
    const rest = moduleSpecifier.slice("@/features/".length);
    const slashIndex = rest.indexOf("/");
    imports.push({
      featureName: slashIndex === -1 ? rest : rest.slice(0, slashIndex),
      privatePath: slashIndex === -1 ? "" : rest.slice(slashIndex),
      specifier: moduleSpecifier,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    });
  }

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      record(node, node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
    ) {
      record(node, node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return imports;
}

function owningFeature(file) {
  const featurePath = relative(featuresRoot, file);
  if (featurePath.startsWith(`..${sep}`) || featurePath === "..") return null;
  return featurePath.split(sep)[0] ?? null;
}

const violations = [];
const appFiles = await walk(appRoot);
const featureFiles = await walk(featuresRoot);

for (const file of [...appFiles, ...featureFiles]) {
  const content = await readFile(file, "utf8");
  const owner = owningFeature(file);

  for (const imported of featureImports(file, content)) {
    const crossesFeatureSeam = owner === null || owner !== imported.featureName;
    if (imported.privatePath && crossesFeatureSeam) {
      const caller = owner ? `feature ${owner}` : "app";
      violations.push({
        file,
        line: imported.line,
        message: `${caller} must import ${imported.featureName} through @/features/${imported.featureName}, not ${imported.specifier}`,
      });
      continue;
    }

    if (!imported.privatePath && !(await hasFeatureEntrypoint(imported.featureName))) {
      violations.push({
        file,
        line: imported.line,
        message: `@/features/${imported.featureName} has no public index entrypoint`,
      });
    }
  }
}

if (violations.length) {
  console.error("Feature seam check failed:\n");
  for (const violation of violations) {
    console.error(`- ${relative(webRoot, violation.file)}:${violation.line} ${violation.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Feature seam check passed for ${appFiles.length} app files and ${featureFiles.length} feature files.`,
  );
}
