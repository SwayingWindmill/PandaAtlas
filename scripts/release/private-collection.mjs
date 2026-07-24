import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { ReleaseGateError, runReleaseGate } from "./gate-core.mjs";
import { repoRoot, runCommand } from "./default.mjs";

const reportDir = process.env.RELEASE_GATE_REPORT_DIR
  ? path.resolve(repoRoot, process.env.RELEASE_GATE_REPORT_DIR)
  : path.join(repoRoot, ".release-gate");

const isolatedApi = ["run", "--isolated", "--directory", "services/api", "--frozen", "--extra", "dev"];

export async function runPrivateCollectionGate() {
  return runReleaseGate({
    gate: "private-collection",
    reportDir,
    steps: [
      {
        id: "curation-contract",
        label: "Private collection curation contract tests",
        run: () =>
          runCommand("uv", [
            ...isolatedApi,
            "python",
            "-m",
            "unittest",
            "discover",
            "-s",
            "../../scripts/curation/tests",
            "-p",
            "test_validate_panda_curation.py",
          ]),
      },
      {
        id: "curation-data",
        label: "Private collection curation data",
        dependsOn: ["curation-contract"],
        run: () =>
          runCommand("uv", [
            ...isolatedApi,
            "python",
            "../../scripts/curation/validate_panda_curation.py",
          ]),
      },
      {
        id: "media-pipeline",
        label: "Private collection media safety tests",
        dependsOn: ["curation-data"],
        run: () => runCommand("npm", ["run", "test:panda-media"]),
      },
      {
        id: "media-library-contract",
        label: "Dual media library contract tests",
        dependsOn: ["curation-data", "media-pipeline"],
        run: () => runCommand("npm", ["run", "test:media-library"]),
      },
      {
        id: "media-library-data",
        label: "Dual media library reproducibility",
        dependsOn: ["media-library-contract"],
        run: () => runCommand("npm", ["run", "check:media-library"]),
      },
      {
        id: "commons-media-discovery-contract",
        label: "Commons media discovery contract tests",
        dependsOn: ["media-library-data"],
        run: () => runCommand("npm", ["run", "test:commons-media-discovery"]),
      },
      {
        id: "commons-media-queue-data",
        label: "Commons media discovery queue reproducibility",
        dependsOn: ["commons-media-discovery-contract"],
        run: () => runCommand("npm", ["run", "check:commons-media-queue"]),
      },
      {
        id: "commons-media-result-data",
        label: "Commons media fixture result reproducibility",
        dependsOn: ["commons-media-queue-data"],
        run: () => runCommand("npm", ["run", "check:commons-media-discovery"]),
      },
      {
        id: "api-tests",
        label: "FastAPI regression tests",
        dependsOn: ["curation-data"],
        run: () => runCommand("uv", [...isolatedApi, "pytest", "-q"]),
      },
      {
        id: "web-lint",
        label: "Web lint",
        run: () => runCommand("npm", ["run", "lint:web"]),
      },
      {
        id: "web-typecheck",
        label: "Web typecheck",
        dependsOn: ["web-lint"],
        run: () => runCommand("npm", ["run", "typecheck:web"]),
      },
      {
        id: "web-build",
        label: "Web production build",
        dependsOn: [
          "web-typecheck",
          "api-tests",
          "media-pipeline",
          "media-library-data",
          "commons-media-result-data",
        ],
        run: () => runCommand("npm", ["run", "build:web"]),
      },
    ],
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPrivateCollectionGate().catch((error) => {
    if (!(error instanceof ReleaseGateError)) {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}
