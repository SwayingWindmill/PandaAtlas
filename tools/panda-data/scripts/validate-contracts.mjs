import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const scriptDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const contractDirectory = resolve(repositoryRoot, "contracts/panda-data");

const cases = [
  ["artifact-manifest.v1.schema.json", "artifact-manifest.valid.json"],
  ["pipeline-job.v1.schema.json", "pipeline-job.valid.json"],
  ["pipeline-result.v1.schema.json", "pipeline-result.valid.json"],
];

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  validateFormats: true,
});
addFormats(ajv);

const validators = new Map();
for (const [schemaFile, fixtureFile] of cases) {
  const schema = JSON.parse(await readFile(resolve(contractDirectory, schemaFile), "utf8"));
  const fixture = JSON.parse(await readFile(resolve(contractDirectory, "fixtures", fixtureFile), "utf8"));
  const validate = ajv.compile(schema);
  validators.set(schemaFile, validate);
  if (!validate(fixture)) {
    throw new Error(`${fixtureFile} does not satisfy ${schemaFile}: ${ajv.errorsText(validate.errors)}`);
  }
}

const validateJob = validators.get("pipeline-job.v1.schema.json");
if (!validateJob) throw new Error("pipeline-job validator was not compiled");
const invalidJob = JSON.parse(
  await readFile(resolve(contractDirectory, "fixtures/pipeline-job.valid.json"), "utf8"),
);
invalidJob.unexpected = true;
if (validateJob(invalidJob)) {
  throw new Error("pipeline-job contract accepted an unexpected property under strict validation");
}

process.stdout.write(`Validated ${cases.length} panda-data Draft 2020-12 contracts with Ajv strict mode.\n`);
