import type { PublicRelease } from "./publication.application.js";
import type { PublicationChange, PublicationMemberKind, PublicationChangeType } from "./publication-change.port.js";

export interface PublicationResourceCounts {
  panda: number;
  institution: number;
  place: number;
  lineage: number;
  residency: number;
  lifeEvent: number;
  media: number;
  evidence: number;
}

export interface PublicationReleaseSummary extends PublicRelease {
  isCurrent: boolean;
  suspended: boolean;
  counts: PublicationResourceCounts;
  blockers: string[];
}

export interface PublicationReleaseListQuery {
  limit: number;
  offset: number;
  lifecycleState?: "building" | "sealed";
}

export interface PublicationReleasePage {
  currentReleaseId?: string;
  currentRelease?: PublicationReleaseSummary;
  items: PublicationReleaseSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface PublicationChangeSummary {
  resourceKind: PublicationMemberKind;
  added: number;
  changed: number;
  removed: number;
}

export interface PublicationTransition {
  transitionId: string;
  transitionType: string;
  fromReleaseId?: string;
  actor: string;
  reason: string;
  occurredAt: string;
}

export interface PublicationReleaseInspection {
  currentReleaseId?: string;
  release: PublicationReleaseSummary;
  changes: PublicationChangeSummary[];
  changeTotal: number;
  changeOffset: number;
  changeItems: PublicationChange[];
  transitions: PublicationTransition[];
}

export interface PublicationInspectionPort {
  listReleases(query: PublicationReleaseListQuery): Promise<PublicationReleasePage>;
  inspectRelease(releaseId: string, query?: { changeLimit: number; changeOffset: number }): Promise<PublicationReleaseInspection | undefined>;
}

export const PUBLICATION_INSPECTION_PORT = Symbol("PUBLICATION_INSPECTION_PORT");

export function summarizePublicationChanges(
  changes: ReadonlyArray<{ resourceKind: PublicationMemberKind; changeType: PublicationChangeType }>,
): PublicationChangeSummary[] {
  const grouped = new Map<PublicationMemberKind, PublicationChangeSummary>();
  for (const change of changes) {
    const summary = grouped.get(change.resourceKind) ?? {
      resourceKind: change.resourceKind,
      added: 0,
      changed: 0,
      removed: 0,
    };
    summary[change.changeType] += 1;
    grouped.set(change.resourceKind, summary);
  }
  return [...grouped.values()].sort((left, right) => left.resourceKind.localeCompare(right.resourceKind));
}

export function pagePublicationChanges(
  changes: readonly PublicationChange[],
  query: { changeLimit: number; changeOffset: number },
) {
  return {
    changeTotal: changes.length,
    changeOffset: query.changeOffset,
    changeItems: changes.slice(query.changeOffset, query.changeOffset + query.changeLimit),
  };
}
