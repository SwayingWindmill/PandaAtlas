import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = path.resolve("features/admin");
const files = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(full);
    else if (entry.name.endsWith(".tsx")) files.push(full);
  }
}

await visit(root);
const totals = { nativeInputs: 0, nativeSelects: 0, nativeTextareas: 0, nativeButtons: 0, nativeDetails: 0 };
const report = await Promise.all(files.map(async (file) => {
  const source = await readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const natives = { input: 0, select: 0, textarea: 0, button: 0, details: 0 };
  let maxJsxDepth = 0;
  let conditionalBranches = 0;
  let stateHooks = 0;
  let componentFunctions = 0;
  let elementCount = 0;
  function walk(node, depth) {
    const jsx = ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
    const nextDepth = jsx ? depth + 1 : depth;
    if (jsx) {
      maxJsxDepth = Math.max(maxJsxDepth, nextDepth);
      elementCount++;
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText(ast);
        if (Object.hasOwn(natives, tag)) natives[tag]++;
      }
    }
    if (ts.isConditionalExpression(node)) conditionalBranches++;
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "useState") stateHooks++;
    if (ts.isFunctionDeclaration(node) && /^[A-Z]/.test(node.name?.text ?? "")) componentFunctions++;
    ts.forEachChild(node, (child) => walk(child, nextDepth));
  }
  walk(ast, 0);
  totals.nativeInputs += natives.input;
  totals.nativeSelects += natives.select;
  totals.nativeTextareas += natives.textarea;
  totals.nativeButtons += natives.button;
  totals.nativeDetails += natives.details;
  return {
    file: path.relative(root, file).replaceAll("\\", "/"),
    lines: source.split("\n").length,
    maxJsxDepth,
    elements: elementCount,
    conditionalBranches,
    stateHooks,
    componentFunctions,
    native: natives,
  };
}));
report.sort((a, b) => b.lines - a.lines);
console.log(JSON.stringify({ totalFiles: files.length, nativeTotals: totals, files: report }, null, 2));
