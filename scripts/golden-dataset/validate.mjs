import process from "node:process";

import { loadGoldenDataset, validateGoldenDataset } from "./lib.mjs";

function printHumanReport(report) {
  if (report.valid) {
    console.log("Golden dataset validation passed.");
    return;
  }

  console.error(`Golden dataset validation failed with ${report.errors.length} error(s):`);
  for (const error of report.errors) {
    console.error(`- [${error.code}] ${error.path}: ${error.message}`);
  }
}

const dataset = await loadGoldenDataset();
const report = validateGoldenDataset(dataset);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHumanReport(report);
}

if (!report.valid) {
  process.exitCode = 1;
}
