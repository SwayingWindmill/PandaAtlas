import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const defaultControlMatrixPath = path.join(
  repositoryRoot,
  "contracts",
  "zhipanda-v1-operational-controls.v1.json",
);

const REQUIRED_CONTROLS = new Map([
  ["foundation-preflight", ["available", "default"]],
  ["seedless-migration-and-private-schema", ["available", "default"]],
  ["public-private-api-boundary", ["available", "default"]],
  ["admin-runtime-isolation", ["available", "default"]],
  ["capability-separation", ["available", "default"]],
  ["sensitive-log-redaction", ["available", "default"]],
  ["fastapi-serverless-boundary", ["available", "default"]],
  ["web-production-build", ["available", "default"]],
  ["worker-d1-and-http", ["available", "default"]],
  ["performance-budgets", ["available", "default"]],
  ["immutable-operational-evidence", ["available", "default"]],
  ["extended-real-services", ["final-candidate", "extended"]],
  ["linux-map-close", ["final-candidate", "map-close"]],
  ["windows-map-close", ["final-candidate", "windows"]],
  ["browser-mobile-wcag", ["final-candidate", "map-close"]],
]);

const REQUIRED_FINAL_CANDIDATE_CONTROLS = [
  "extended-real-services",
  "linux-map-close",
  "windows-map-close",
  "browser-mobile-wcag",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireRepositoryPath(errors, root, relativePath, label) {
  if (!isNonEmptyString(relativePath)) {
    errors.push(`${label} must be a repository-relative path.`);
    return null;
  }
  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    errors.push(`${label} must stay inside the repository.`);
    return null;
  }
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    errors.push(`${label} references missing path ${relativePath}.`);
    return null;
  }
  return absolutePath;
}

export function loadOperationalControlMatrix(filePath = defaultControlMatrixPath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function validateOperationalControlMatrix(
  matrix,
  {
    checkEvidence = true,
    root = repositoryRoot,
  } = {},
) {
  const errors = [];

  if (matrix.schema_version !== 1) {
    errors.push("schema_version must be 1.");
  }
  if (matrix.matrix_id !== "zhipanda-v1-operational-controls") {
    errors.push("matrix_id must be zhipanda-v1-operational-controls.");
  }
  if (matrix.issue !== 200) {
    errors.push("issue must be 200.");
  }
  if (!new Set(["in-progress", "complete"]).has(matrix.status)) {
    errors.push("status must be in-progress or complete.");
  }

  const controls = Array.isArray(matrix.controls) ? matrix.controls : [];
  const seen = new Set();
  for (const control of controls) {
    const id = control?.id;
    if (!isNonEmptyString(id)) {
      errors.push("controls contains a record without an id.");
      continue;
    }
    if (seen.has(id)) {
      errors.push(`controls contains duplicate id ${id}.`);
    }
    seen.add(id);

    const expected = REQUIRED_CONTROLS.get(id);
    if (!expected) {
      errors.push(`Unsupported operational control ${id}.`);
      continue;
    }
    const [expectedStatus, expectedGate] = expected;
    if (control.status !== expectedStatus) {
      errors.push(`${id} status must be ${expectedStatus}.`);
    }
    if (control.gate !== expectedGate) {
      errors.push(`${id} gate must be ${expectedGate}.`);
    }
    if (!isNonEmptyString(control.owner)) {
      errors.push(`${id} must define an owner.`);
    }
    if (!isNonEmptyString(control.proves)) {
      errors.push(`${id} must describe what it proves.`);
    }

    const evidence = Array.isArray(control.evidence) ? control.evidence : [];
    if (evidence.length === 0) {
      errors.push(`${id} must declare repository evidence.`);
      continue;
    }
    for (const [index, item] of evidence.entries()) {
      const label = `${id} evidence[${index}]`;
      const absolutePath = checkEvidence
        ? requireRepositoryPath(errors, root, item?.path, label)
        : null;
      if (!Array.isArray(item?.contains)) {
        errors.push(`${label}.contains must be an array.`);
        continue;
      }
      if (checkEvidence && absolutePath) {
        const content = readFileSync(absolutePath, "utf8");
        for (const token of item.contains) {
          if (!isNonEmptyString(token)) {
            errors.push(`${label} contains an empty assertion token.`);
          } else if (!content.includes(token)) {
            errors.push(`${label} is missing required assertion token ${JSON.stringify(token)}.`);
          }
        }
      }
    }
  }

  for (const id of REQUIRED_CONTROLS.keys()) {
    if (!seen.has(id)) errors.push(`Missing required operational control ${id}.`);
  }

  const completion = matrix.completion_rule ?? {};
  if (!Array.isArray(completion.required_final_candidate_controls)
    || JSON.stringify(completion.required_final_candidate_controls)
      !== JSON.stringify(REQUIRED_FINAL_CANDIDATE_CONTROLS)) {
    errors.push("completion_rule.required_final_candidate_controls must retain all final-candidate controls.");
  }
  if (!isNonEmptyString(completion.rule)
    || !completion.rule.includes("dated immutable evidence")
    || !completion.rule.includes("selected candidate")) {
    errors.push("completion_rule.rule must require dated immutable evidence from the selected candidate.");
  }

  const finalCandidateControls = controls.filter(
    (control) => control.status === "final-candidate",
  );
  if (matrix.status === "complete" && finalCandidateControls.length > 0) {
    errors.push("A complete operational control matrix cannot contain final-candidate controls without candidate evidence.");
  }

  if (errors.length > 0) {
    throw new Error(`Operational control validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    matrix_id: matrix.matrix_id,
    status: matrix.status,
    controls: controls.length,
    available_controls: controls.filter((control) => control.status === "available").length,
    final_candidate_controls: finalCandidateControls.length,
    evidence_files: controls.reduce(
      (total, control) => total + control.evidence.length,
      0,
    ),
    release_gate_integrated: true,
  };
}

export function run(filePath = defaultControlMatrixPath) {
  const matrix = loadOperationalControlMatrix(filePath);
  const summary = validateOperationalControlMatrix(matrix);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv[2] ? path.resolve(process.argv[2]) : defaultControlMatrixPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
