// One reviewed release intent, read from data/release-manifests/<version>.json.
// contracts/release-manifest.v1.json documents the same shape; a unit test keeps the two in step.

export type ReleaseAction = "publish" | "rollback";

export interface ReleaseManifest {
  version: string;
  action: ReleaseAction;
  reason: string;
}

export const RELEASE_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
export const RELEASE_ACTIONS: readonly ReleaseAction[] = ["publish", "rollback"];
export const RELEASE_REASON_LENGTH = { minimum: 10, maximum: 500 } as const;
const FIELDS = ["schema_version", "version", "action", "reason"];

export class ReleaseManifestError extends Error {
  public constructor(public readonly violations: string[]) {
    super(`Release manifest is invalid: ${violations.join("; ")}`);
    this.name = "ReleaseManifestError";
  }
}

/** Validates a parsed manifest; `fileName` is the manifest's base name, which must be `<version>.json`. */
export function parseReleaseManifest(value: unknown, fileName: string): ReleaseManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReleaseManifestError(["the manifest must be a JSON object"]);
  }
  const record = value as Record<string, unknown>;
  const violations: string[] = [];
  for (const key of Object.keys(record)) {
    if (!FIELDS.includes(key)) violations.push(`unknown field ${key}`);
  }
  if (record.schema_version !== 1) violations.push("schema_version must be 1");
  const version = typeof record.version === "string" ? record.version : "";
  if (!RELEASE_VERSION_PATTERN.test(version)) violations.push("version must look like 2026.10.26.1 or 2026.10.26.1-label");
  else if (fileName !== `${version}.json`) violations.push(`the file must be named ${version}.json`);
  const action = record.action;
  if (!RELEASE_ACTIONS.includes(action as ReleaseAction)) violations.push(`action must be one of ${RELEASE_ACTIONS.join(", ")}`);
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";
  if (reason.length < RELEASE_REASON_LENGTH.minimum || reason.length > RELEASE_REASON_LENGTH.maximum) {
    violations.push(`reason must be ${RELEASE_REASON_LENGTH.minimum} to ${RELEASE_REASON_LENGTH.maximum} characters`);
  }
  if (violations.length > 0) throw new ReleaseManifestError(violations);
  return { version, action: action as ReleaseAction, reason };
}
