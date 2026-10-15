import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const SOURCE_ROOT = fileURLToPath(new URL("../../src/", import.meta.url));

// Every hand-written TypeScript file of the API source, for guards that read what the API names.
export function apiSourceFiles(directory = SOURCE_ROOT): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return apiSourceFiles(absolute);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".generated.ts") ? [absolute] : [];
  });
}
