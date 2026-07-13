import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const manifestPath = path.join(root, "contracts/public-api-v1.json");
const targets = [
  { label: "frontend", path: path.join(root, "apps/web/lib/types.ts") },
  { label: "worker", path: path.join(root, "services/worker-api/src/types.ts") },
];

function propertyName(member) {
  if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
    return member.name.text;
  }
  throw new Error("Public contract fields must use identifier or string-literal names");
}

function isNullType(typeNode) {
  return ts.isLiteralTypeNode(typeNode) && typeNode.literal.kind === ts.SyntaxKind.NullKeyword;
}

function isNullable(typeNode) {
  return isNullType(typeNode) || (ts.isUnionTypeNode(typeNode) && typeNode.types.some(isNullType));
}

function readInterfaces(sourceText, filePath) {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const interfaces = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;
    const fields = new Map();
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member) || !member.type) continue;
      fields.set(propertyName(member), {
        required: member.questionToken === undefined,
        nullable: isNullable(member.type),
      });
    }
    interfaces.set(statement.name.text, fields);
  }
  return interfaces;
}

function compareSchema(targetLabel, schemaName, expectedFields, actualFields) {
  if (!actualFields) {
    throw new Error(`${targetLabel} is missing public interface ${schemaName}`);
  }
  const expectedNames = Object.keys(expectedFields).sort();
  const actualNames = [...actualFields.keys()].sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) {
    throw new Error(
      `${targetLabel} ${schemaName} fields drifted: expected ${expectedNames.join(", ")}; got ${actualNames.join(", ")}`,
    );
  }
  for (const [fieldName, expected] of Object.entries(expectedFields)) {
    const actual = actualFields.get(fieldName);
    if (!actual || actual.nullable !== expected.nullable) {
      throw new Error(
        `${targetLabel} ${schemaName}.${fieldName} nullability drifted: expected nullable=${expected.nullable}; got nullable=${actual?.nullable}`,
      );
    }
  }
}

async function assertWorkerIsReadOnly() {
  const workerIndex = await readFile(path.join(root, "services/worker-api/src/index.ts"), "utf8");
  for (const forbidden of ["/api/v1/admin/", "./repositories/admin"]) {
    if (workerIndex.includes(forbidden)) {
      throw new Error(`Worker public runtime still exposes authoritative admin behavior: ${forbidden}`);
    }
  }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const target of targets) {
  const sourceText = await readFile(target.path, "utf8");
  const interfaces = readInterfaces(sourceText, target.path);
  for (const [schemaName, schema] of Object.entries(manifest.schemas)) {
    compareSchema(target.label, schemaName, schema.fields, interfaces.get(schemaName));
  }
}
await assertWorkerIsReadOnly();
console.log(`Public API boundary check passed for ${Object.keys(manifest.schemas).length} shared schemas.`);
