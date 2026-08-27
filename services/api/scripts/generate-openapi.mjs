import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApplication } from "../dist/bootstrap.js";
import { createV2OpenApiDocument } from "../dist/openapi.js";

process.env.APP_ENV ??= "test";
process.env.CORS_ALLOW_ORIGINS ??= "http://localhost:3000";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../openapi/panda-atlas-v2.json");
const app = await createApplication();

try {
  const document = createV2OpenApiDocument(app);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  process.stdout.write(`${outputPath}\n`);
} finally {
  await app.close();
}
