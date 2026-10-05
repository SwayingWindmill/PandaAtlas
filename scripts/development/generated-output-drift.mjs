import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function normalizeGeneratedText(value) {
  return value.replaceAll("\r\n", "\n");
}

export async function captureGeneratedOutputs(repoRoot, relativePaths) {
  return new Map(await Promise.all(relativePaths.map(async (relativePath) => {
    const raw = await readFile(path.join(repoRoot, relativePath), "utf8");
    return [relativePath, { raw, normalized: normalizeGeneratedText(raw) }];
  })));
}

export async function settleGeneratedOutputs(repoRoot, before, after, relativePaths) {
  const drifted = [];

  for (const relativePath of relativePaths) {
    const previous = before.get(relativePath);
    const generated = after.get(relativePath);
    if (!previous || !generated || previous.normalized !== generated.normalized) {
      drifted.push(relativePath);
      continue;
    }
    if (previous.raw !== generated.raw) {
      await writeFile(path.join(repoRoot, relativePath), previous.raw, "utf8");
    }
  }

  return drifted;
}
