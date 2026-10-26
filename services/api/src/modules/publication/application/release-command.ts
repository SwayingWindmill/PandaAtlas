import type {
  PublicationCommandContext,
  PublicationPort,
  PublicationReleaseResult,
} from "./publication.application.js";
import type { PublicationMemberKind } from "./publication-change.port.js";
import type { PublicationInspectionPort, PublicationReleaseInspection } from "./publication-inspection.port.js";
import type { ReleaseManifest } from "./release-manifest.js";

// The release.build and release.publish batch operations. Build makes the release a manifest names and
// reports what it would change; publish seals and activates exactly that release, or rolls back to an
// older sealed one. Both are safe to repeat: a step that already happened is reported, not redone.

export interface ReleaseCommandPorts {
  publication: PublicationPort;
  inspection: PublicationInspectionPort;
}

export interface ReleaseReport {
  operation: "build" | "publish" | "rollback";
  version: string;
  releaseId: string;
  /** What this run did, in order, e.g. ["built"] or ["already sealed", "activated"]. */
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

export async function buildRelease(
  ports: ReleaseCommandPorts,
  manifest: ReleaseManifest,
  context: PublicationCommandContext,
): Promise<ReleaseReport> {
  if (manifest.action !== "publish") {
    throw new ReleaseCommandError(`${manifest.version} is a rollback manifest: it reuses a sealed release, so there is nothing to build.`);
  }
  const existing = await ports.inspection.findReleaseId(manifest.version);
  const releaseId = existing ?? (await ports.publication.build(manifest.version, context)).releaseId;
  return {
    operation: "build",
    version: manifest.version,
    releaseId,
    steps: [existing === undefined ? "built" : "already built"],
    inspection: await inspect(ports, releaseId),
  };
}

export async function publishRelease(
  ports: ReleaseCommandPorts,
  manifest: ReleaseManifest,
  context: PublicationCommandContext,
  reason: string,
): Promise<ReleaseReport> {
  const releaseId = await ports.inspection.findReleaseId(manifest.version);
  if (releaseId === undefined) {
    throw new ReleaseCommandError(
      manifest.action === "publish"
        ? `Release ${manifest.version} does not exist. Run release.build with this manifest and review its report first.`
        : `Release ${manifest.version} does not exist, so there is nothing to roll back to.`,
    );
  }
  const steps: string[] = [];
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

  const inspection = await inspect(ports, releaseId);
  if (!inspection.release.isCurrent) {
    throw new ReleaseCommandError(`${manifest.version} is not the current release after the run; another change may have raced it.`);
  }
  return {
    operation: manifest.action,
    version: manifest.version,
    releaseId,
    steps,
    ...(previousReleaseId === undefined ? {} : { previousReleaseId }),
    inspection,
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
    `- Compared with the current release: ${
      currentReleaseId === undefined ? "none" : currentReleaseId === report.releaseId ? "this release is current" : `\`${currentReleaseId}\``
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
