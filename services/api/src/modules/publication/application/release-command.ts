import type {
  PublicationCommandContext,
  PublicationPort,
  PublicationReleaseResult,
} from "./publication.application.js";
import type { PublicationMemberKind } from "./publication-change.port.js";
import type { PublicationInspectionPort, PublicationReleaseInspection } from "./publication-inspection.port.js";
import type { ReleaseManifest } from "./release-manifest.js";

// The release.publish batch operation. A publish manifest builds, seals and activates its release in one
// run and reports what changed against the previous one; a rollback manifest moves the pointer back to an
// older sealed release. A repeated run reports a step that already happened instead of redoing it.

export interface ReleaseCommandPorts {
  publication: PublicationPort;
  inspection: PublicationInspectionPort;
}

export interface ReleaseReport {
  operation: "publish" | "rollback";
  version: string;
  releaseId: string;
  /** What this run did, in order, e.g. ["built", "sealed", "activated"] or ["already sealed", "already current"]. */
  steps: string[];
  previousReleaseId?: string;
  inspection: PublicationReleaseInspection;
}

export class ReleaseCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ReleaseCommandError";
  }
}

/** Every changed resource is listed in the report artifact; the job summary shows the counts. */
const CHANGE_LIMIT = 5_000;

const REFUSALS: Record<Exclude<PublicationReleaseResult["kind"], "ok" | "already_current">, string> = {
  not_found: "the release does not exist",
  not_ready: "the release has no publishable resources",
  incompatible: "the release was built for another projection schema",
  not_older: "rollback needs a release older than the current one; publish it with action publish instead",
  not_forward: "activation needs a release newer than the current one; use action rollback to go back",
  suspended: "the release is suspended",
};

async function inspect(ports: ReleaseCommandPorts, releaseId: string): Promise<PublicationReleaseInspection> {
  const inspection = await ports.inspection.inspectRelease(releaseId, { changeLimit: CHANGE_LIMIT, changeOffset: 0 });
  if (inspection === undefined) throw new ReleaseCommandError(`Release ${releaseId} disappeared during the run.`);
  return inspection;
}

function settled(
  result: PublicationReleaseResult,
  version: string,
  step: { verb: string; done: string },
  steps: string[],
): string | undefined {
  if (result.kind === "already_current") {
    steps.push("already current");
    return undefined;
  }
  if (result.kind !== "ok") throw new ReleaseCommandError(`Cannot ${step.verb} ${version}: ${REFUSALS[result.kind]}.`);
  steps.push(step.done);
  return result.previousReleaseId;
}

export async function publishRelease(
  ports: ReleaseCommandPorts,
  manifest: ReleaseManifest,
  context: PublicationCommandContext,
  reason: string,
): Promise<ReleaseReport> {
  const steps: string[] = [];
  let releaseId = await ports.inspection.findReleaseId(manifest.version);
  if (releaseId === undefined) {
    if (manifest.action === "rollback") {
      throw new ReleaseCommandError(`Release ${manifest.version} does not exist, so there is nothing to roll back to.`);
    }
    releaseId = (await ports.publication.build(manifest.version, context)).releaseId;
    steps.push("built");
  }
  // Changes are measured against the current release, so they are read before this release replaces it.
  const before = await inspect(ports, releaseId);
  let previousReleaseId: string | undefined;
  if (manifest.action === "publish") {
    const release = await ports.publication.getRelease(releaseId);
    if (release?.lifecycleState === "building") {
      const sealed = await ports.publication.seal(releaseId, context, reason);
      settled(sealed, manifest.version, { verb: "seal", done: "sealed" }, steps);
    } else {
      steps.push("already sealed");
    }
    const activated = await ports.publication.activate(releaseId, context, reason);
    previousReleaseId = settled(activated, manifest.version, { verb: "activate", done: "activated" }, steps);
  } else {
    const rolledBack = await ports.publication.rollback(releaseId, context, reason);
    previousReleaseId = settled(rolledBack, manifest.version, { verb: "roll back to", done: "rolled back" }, steps);
  }

  const after = await inspect(ports, releaseId);
  if (!after.release.isCurrent) {
    throw new ReleaseCommandError(`${manifest.version} is not the current release after the run; another change may have raced it.`);
  }
  return {
    operation: manifest.action,
    version: manifest.version,
    releaseId,
    steps,
    ...(previousReleaseId === undefined ? {} : { previousReleaseId }),
    inspection: { ...before, release: after.release },
  };
}

/** Markdown for the GitHub job summary: what the release holds and how it differs from the current one. */
export function renderReleaseReport(report: ReleaseReport): string {
  const { release, changes, changeTotal, currentReleaseId } = report.inspection;
  const changesByKind = new Map(changes.map((change) => [change.resourceKind, change]));
  const kinds: [keyof typeof release.counts, PublicationMemberKind][] = [
    ["panda", "panda"],
    ["institution", "institution"],
    ["place", "place"],
    ["lineage", "lineage"],
    ["residency", "residency"],
    ["lifeEvent", "life_event"],
    ["media", "media"],
    ["evidence", "evidence"],
  ];
  const lines = [
    `## Release ${report.version}: ${report.steps.join(", ")}`,
    "",
    `- Release ID: \`${report.releaseId}\``,
    `- State: \`${release.lifecycleState}\`${release.isCurrent ? ", current" : ""}`,
    `- Compared with the release current before this run: ${
      currentReleaseId === undefined ? "none" : currentReleaseId === report.releaseId ? "this release, already current" : `\`${currentReleaseId}\``
    }`,
    ...(report.previousReleaseId === undefined ? [] : [`- Replaced: \`${report.previousReleaseId}\` (roll back to it with a rollback manifest)`]),
    "",
    "| Resource | In release | Added | Changed | Removed |",
    "|---|---:|---:|---:|---:|",
    ...kinds.map(([countKey, changeKind]) => {
      const change = changesByKind.get(changeKind);
      return `| ${changeKind} | ${release.counts[countKey]} | ${change?.added ?? 0} | ${change?.changed ?? 0} | ${change?.removed ?? 0} |`;
    }),
    "",
    `${changeTotal} changed resources; every one is listed in the uploaded report.`,
  ];
  if (release.blockers.length > 0) lines.push("", "Blockers:", ...release.blockers.map((blocker) => `- ${blocker}`));
  return `${lines.join("\n")}\n`;
}
