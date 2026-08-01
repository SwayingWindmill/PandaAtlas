import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_EXPERIENCE_RELEASE_VERSION = "2026.07.31.1";
export const publicExperienceApiPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "data",
  "public-releases",
  PUBLIC_EXPERIENCE_RELEASE_VERSION,
  "api.json",
);
export const generatedPublicExperiencesPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "apps",
  "web",
  "lib",
  "generated",
  "public-experiences.ts",
);

export function normalizeGeneratedModule(value) {
  return value.replace(/\r\n/g, "\n");
}

export function renderPublicExperiencesModule(api) {
  const events = (api.events ?? []).map((event) => ({
    event_date_precision: "day",
    from_facility_id: null,
    from_coarse_location: null,
    to_facility_id: null,
    to_coarse_location: null,
    ...event,
  }));
  const familyStories = api.family_stories ?? [];
  const sources = api.sources ?? [];
  const cohort = api.profile_cohort ?? [];
  return `// Generated from Public Release ${api.release.dataset_release_version}.\n`
    + `// Run npm run generate:public-experiences after changing the release projection.\n\n`
    + `import type { PandaDomainEventSummary, PublicFamilyStoryRecord, PublicProfileCohortRecord, PublicSourceSummary } from \"@/lib/types\";\n\n`
    + `export const PUBLIC_EXPERIENCE_RELEASE = ${JSON.stringify(api.release, null, 2)} as const;\n\n`
    + `export const TRUSTED_PUBLIC_EVENTS: PandaDomainEventSummary[] = ${JSON.stringify(events, null, 2)};\n\n`
    + `export const TRUSTED_FAMILY_STORIES: PublicFamilyStoryRecord[] = ${JSON.stringify(familyStories, null, 2)};\n\n`
    + `export const TRUSTED_PUBLIC_SOURCES: PublicSourceSummary[] = ${JSON.stringify(sources, null, 2)};\n\n`
    + `export const TRUSTED_PROFILE_COHORT: PublicProfileCohortRecord[] = ${JSON.stringify(cohort, null, 2)};\n`;
}

export async function readPublicExperienceApi() {
  return JSON.parse(await readFile(publicExperienceApiPath, "utf8"));
}

async function main() {
  const api = await readPublicExperienceApi();
  const expected = renderPublicExperiencesModule(api);
  if (process.argv.includes("--check")) {
    const actual = await readFile(generatedPublicExperiencesPath, "utf8").catch(() => "");
    if (normalizeGeneratedModule(actual) !== normalizeGeneratedModule(expected)) {
      throw new Error(
        "Generated public experiences drifted. Run npm run generate:public-experiences.",
      );
    }
    console.log("Generated public experiences are current.");
    return;
  }
  await mkdir(path.dirname(generatedPublicExperiencesPath), { recursive: true });
  await writeFile(generatedPublicExperiencesPath, expected, "utf8");
  console.log(`Generated ${generatedPublicExperiencesPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
