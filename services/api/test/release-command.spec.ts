import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PublicationInspectionPort, PublicationReleaseInspection } from "../src/modules/publication/application/publication-inspection.port.js";
import type { PublicRelease, PublicationPort, PublicationReleaseResult } from "../src/modules/publication/application/publication.application.js";
import { buildRelease, publishRelease, renderReleaseReport } from "../src/modules/publication/application/release-command.js";
import {
  RELEASE_ACTIONS,
  RELEASE_REASON_LENGTH,
  RELEASE_VERSION_PATTERN,
  ReleaseManifestError,
  parseReleaseManifest,
} from "../src/modules/publication/application/release-manifest.js";

const context = { actor: { kind: "system" as const, systemKey: "release-batch-workflow" }, correlationId: "run-1" };
const manifest = { version: "2026.10.26.1", action: "publish" as const, reason: "Publish the institution profiles." };

function release(releaseId: string, lifecycleState: PublicRelease["lifecycleState"]): PublicRelease {
  return { releaseId, version: "2026.10.26.1", projectionSchemaVersion: 1, lifecycleState, builtAt: "2026-10-26T00:00:00Z" };
}

/** A publication backend with one release whose state the test sets, recording every command. */
function fakePorts(state: { releaseId?: string; lifecycleState?: PublicRelease["lifecycleState"]; current?: boolean }, results: {
  seal?: PublicationReleaseResult;
  activate?: PublicationReleaseResult;
  rollback?: PublicationReleaseResult;
} = {}) {
  const calls: string[] = [];
  const ok = (id: string): PublicationReleaseResult => ({ kind: "ok", release: release(id, "sealed"), previousReleaseId: "previous" });
  const publication = {
    build: () => {
      calls.push("build");
      state.releaseId = "new";
      state.lifecycleState = "building";
      return Promise.resolve(release("new", "building"));
    },
    getRelease: (id: string) =>
      Promise.resolve(state.releaseId === id ? release(id, state.lifecycleState ?? "building") : undefined),
    seal: (id: string) => {
      calls.push("seal");
      state.lifecycleState = "sealed";
      return Promise.resolve(results.seal ?? ok(id));
    },
    activate: (id: string) => {
      calls.push("activate");
      const result = results.activate ?? (state.current ? { kind: "already_current" as const, release: release(id, "sealed") } : ok(id));
      if (result.kind !== "not_forward") state.current = true;
      return Promise.resolve(result);
    },
    rollback: (id: string) => {
      calls.push("rollback");
      const result = results.rollback ?? ok(id);
      if (result.kind === "ok") state.current = true;
      return Promise.resolve(result);
    },
  } as unknown as PublicationPort;
  const inspection: PublicationInspectionPort = {
    findReleaseId: (version) => Promise.resolve(version === manifest.version ? state.releaseId : undefined),
    listReleases: () => Promise.reject(new Error("unused")),
    inspectRelease: (id) => Promise.resolve({
      currentReleaseId: state.current ? id : "previous",
      release: {
        ...release(id, state.lifecycleState ?? "building"),
        isCurrent: state.current === true,
        suspended: false,
        counts: { panda: 925, institution: 5, place: 12, lineage: 15, residency: 23, lifeEvent: 26, media: 900, evidence: 40 },
        blockers: [],
      },
      changes: [{ resourceKind: "institution", added: 5, changed: 0, removed: 0 }],
      changeTotal: 5,
      changeOffset: 0,
      changeItems: [],
      transitions: [],
    } satisfies PublicationReleaseInspection),
  };
  return { ports: { publication, inspection }, calls };
}

describe("release manifest", () => {
  it("accepts a manifest named after its version", () => {
    expect(parseReleaseManifest({ schema_version: 1, ...manifest }, "2026.10.26.1.json")).toEqual(manifest);
  });

  it("names every problem at once", () => {
    let error: unknown;
    try {
      parseReleaseManifest({ schema_version: 2, version: "v1", action: "delete", reason: "short", extra: true }, "v1.json");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ReleaseManifestError);
    expect((error as ReleaseManifestError).violations).toEqual([
      "unknown field extra",
      "schema_version must be 1",
      "version must look like 2026.10.26.1 or 2026.10.26.1-label",
      "action must be one of publish, rollback",
      "reason must be 10 to 500 characters",
    ]);
  });

  it("refuses a file whose name differs from the version it carries", () => {
    expect(() => parseReleaseManifest({ schema_version: 1, ...manifest }, "2026.10.27.1.json")).toThrow(/2026\.10\.26\.1\.json/);
  });

  it("matches the documented contract", () => {
    const contract = JSON.parse(readFileSync(new URL("../../../contracts/release-manifest.v1.json", import.meta.url), "utf8")) as {
      version_pattern: string;
      allowed_actions: string[];
      reason_length: { minimum: number; maximum: number };
      required_fields: string[];
    };
    expect(contract.version_pattern).toBe(RELEASE_VERSION_PATTERN.source);
    expect(contract.allowed_actions).toEqual(RELEASE_ACTIONS);
    expect(contract.reason_length).toEqual(RELEASE_REASON_LENGTH);
    expect(contract.required_fields).toEqual(["schema_version", "version", "action", "reason"]);
  });
});

describe("release command", () => {
  it("builds a new release once and reports the existing one on a repeated run", async () => {
    const { ports, calls } = fakePorts({});
    const first = await buildRelease(ports, manifest, context);
    const second = await buildRelease(ports, manifest, context);
    expect([first.steps, second.steps]).toEqual([["built"], ["already built"]]);
    expect(second.releaseId).toBe(first.releaseId);
    expect(calls).toEqual(["build"]);
  });

  it("does not build for a rollback manifest", async () => {
    const { ports } = fakePorts({});
    await expect(buildRelease(ports, { ...manifest, action: "rollback" }, context)).rejects.toThrow(/nothing to build/);
  });

  it("seals and activates the built release, then reports both as done on a repeated run", async () => {
    const { ports, calls } = fakePorts({ releaseId: "built", lifecycleState: "building" });
    const first = await publishRelease(ports, manifest, context, "reason");
    const second = await publishRelease(ports, manifest, context, "reason");
    expect(first.steps).toEqual(["sealed", "activated"]);
    expect(first.previousReleaseId).toBe("previous");
    expect(second.steps).toEqual(["already sealed", "already current"]);
    expect(calls).toEqual(["seal", "activate", "activate"]);
  });

  it("refuses to publish a release that was never built", async () => {
    const { ports } = fakePorts({});
    await expect(publishRelease(ports, manifest, context, "reason")).rejects.toThrow(/Run release\.build with this manifest/);
  });

  it("sends an older release to rollback instead of activating it", async () => {
    const { ports } = fakePorts({ releaseId: "older", lifecycleState: "sealed" }, { activate: { kind: "not_forward" } });
    await expect(publishRelease(ports, manifest, context, "reason")).rejects.toThrow(/use action rollback/);
  });

  it("rolls the pointer back to an older sealed release", async () => {
    const { ports, calls } = fakePorts({ releaseId: "older", lifecycleState: "sealed" });
    const report = await publishRelease(ports, { ...manifest, action: "rollback" }, context, "reason");
    expect(report.steps).toEqual(["rolled back"]);
    expect(calls).toEqual(["rollback"]);
  });

  it("summarizes counts and changes per resource for the job summary", async () => {
    const { ports } = fakePorts({});
    const markdown = renderReleaseReport(await buildRelease(ports, manifest, context));
    expect(markdown).toContain("## Release 2026.10.26.1: built");
    expect(markdown).toContain("| institution | 5 | 5 | 0 | 0 |");
    expect(markdown).toContain("| panda | 925 | 0 | 0 | 0 |");
  });
});
