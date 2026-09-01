export type ReleaseLifecycleState = "building" | "sealed";
export type PublicationResourceKind = "panda" | "place" | "media" | "evidence";

export interface PublicRelease {
  releaseId: string;
  version: string;
  projectionSchemaVersion: number;
  lifecycleState: ReleaseLifecycleState;
  builtAt: string;
  sealedAt?: string;
  contentSha256?: string;
}

export type PublicationActor =
  | { kind: "account"; accountId: string }
  | { kind: "system"; systemKey: string };

export interface PublicationCommandContext {
  actor: PublicationActor;
  correlationId: string;
}

export type PublicationReleaseResult =
  | { kind: "not_found" }
  | { kind: "not_ready" }
  | { kind: "already_current"; release: PublicRelease }
  | { kind: "incompatible" }
  | { kind: "not_older" }
  | { kind: "not_forward" }
  | { kind: "suspended" }
  | { kind: "ok"; release: PublicRelease; previousReleaseId?: string };

export interface PublicationCoordinator {
  build(version: string, context: PublicationCommandContext): Promise<PublicRelease>;
  seal(releaseId: string, context: PublicationCommandContext, reason: string): Promise<PublicationReleaseResult>;
  activate(releaseId: string, context: PublicationCommandContext, reason: string): Promise<PublicationReleaseResult>;
  rollback(releaseId: string, context: PublicationCommandContext, reason: string): Promise<PublicationReleaseResult>;
  setReleaseSuspension(
    releaseId: string,
    suspended: boolean,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult>;
  setResourceTakedown(
    resourceKind: PublicationResourceKind,
    resourceId: string,
    takenDown: boolean,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<void>;
  getRelease(releaseId: string): Promise<PublicRelease | undefined>;
}

export type PublicationPort = PublicationCoordinator;

export const PUBLICATION_COORDINATOR = Symbol("PUBLICATION_COORDINATOR");
export const PUBLICATION_PORT = Symbol("PUBLICATION_PORT");

export class PublicationApplication implements PublicationPort {
  public constructor(private readonly coordinator: PublicationCoordinator) {}

  public build(version: string, context: PublicationCommandContext): Promise<PublicRelease> {
    const normalized = version.trim();
    if (normalized.length === 0) throw new Error("A public release version is required");
    return this.coordinator.build(normalized, context);
  }

  public seal(
    releaseId: string,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.coordinator.seal(releaseId, context, this.reason(reason));
  }

  public activate(
    releaseId: string,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.coordinator.activate(releaseId, context, this.reason(reason));
  }

  public rollback(
    releaseId: string,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.coordinator.rollback(releaseId, context, this.reason(reason));
  }

  public setReleaseSuspension(
    releaseId: string,
    suspended: boolean,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<PublicationReleaseResult> {
    return this.coordinator.setReleaseSuspension(releaseId, suspended, context, this.reason(reason));
  }

  public setResourceTakedown(
    resourceKind: PublicationResourceKind,
    resourceId: string,
    takenDown: boolean,
    context: PublicationCommandContext,
    reason: string,
  ): Promise<void> {
    if (resourceId.trim().length === 0) throw new Error("A publication resource ID is required");
    return this.coordinator.setResourceTakedown(resourceKind, resourceId, takenDown, context, this.reason(reason));
  }

  public getRelease(releaseId: string): Promise<PublicRelease | undefined> {
    return this.coordinator.getRelease(releaseId);
  }

  private reason(value: string): string {
    const reason = value.trim();
    if (reason.length < 3) throw new Error("A publication reason must contain at least three characters");
    return reason;
  }
}
