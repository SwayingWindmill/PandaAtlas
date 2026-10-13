import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const PUBLIC_EXPERIENCE_RELEASE_VERSION = "2026.08.12.1";
export const publicExperienceApiPath = path.resolve(
  scriptDir,
  "..",
  "..",
  "data",
  "public-releases",
  PUBLIC_EXPERIENCE_RELEASE_VERSION,
  "api.json",
);
const generatedDir = path.resolve(scriptDir, "..", "..", "apps", "web", "lib", "generated");

export function normalizeGeneratedModule(value) {
  return value.replace(/\r\n/g, "\n");
}

// Two modules, so pages that only need stories and the profile cohort never load the large
// event and source lists.
export function renderPublicExperienceModules(api) {
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
  const header = `// Generated from Public Release ${api.release.dataset_release_version}.
`
    + `// Run npm run generate:public-experiences after changing the release projection.

`;
  return [
    {
      path: path.join(generatedDir, "public-experiences.ts"),
      content: header
        + `import type { PublicFamilyStoryRecord, PublicProfileCohortRecord } from \"@/lib/types\";

`
        + `export const PUBLIC_EXPERIENCE_RELEASE = ${JSON.stringify(api.release, null, 2)} as const;

`
        + `export const TRUSTED_FAMILY_STORIES: PublicFamilyStoryRecord[] = ${JSON.stringify(familyStories, null, 2)};

`
        + `export const TRUSTED_PROFILE_COHORT: PublicProfileCohortRecord[] = ${JSON.stringify(cohort, null, 2)};
`,
    },
    {
      path: path.join(generatedDir, "public-experience-evidence.ts"),
      content: header
        + `import type { PandaDomainEventSummary, PublicSourceSummary } from \"@/lib/types\";

`
        + `export const TRUSTED_PUBLIC_EVENTS: PandaDomainEventSummary[] = ${JSON.stringify(events, null, 2)};

`
        + `export const TRUSTED_PUBLIC_SOURCES: PublicSourceSummary[] = ${JSON.stringify(sources, null, 2)};
`,
    },
  ];
}

export async function readPublicExperienceApi() {
  return JSON.parse(await readFile(publicExperienceApiPath, "utf8"));
}

async function main() {
  const modules = renderPublicExperienceModules(await readPublicExperienceApi());
  if (process.argv.includes("--check")) {
    for (const module of modules) {
      const actual = await readFile(module.path, "utf8").catch(() => "");
      if (normalizeGeneratedModule(actual) !== normalizeGeneratedModule(module.content)) {
        throw new Error(
          "Generated public experiences drifted. Run npm run generate:public-experiences.",
        );
      }
    }
    console.log("Generated public experiences are current.");
    return;
  }
  await mkdir(generatedDir, { recursive: true });
  for (const module of modules) {
    await writeFile(module.path, module.content, "utf8");
    console.log(`Generated ${module.path}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
