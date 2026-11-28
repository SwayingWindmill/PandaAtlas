import type {
  PublicPandaSummary,
  PublicResidencySummary,
} from "../../public-read/application/public-read.application.js";
import type { EntityResolutionResult } from "./news-entity-resolution.js";

export type FactChangeKind = "none" | "birth" | "death" | "transfer" | "naming";
export type FactGateStatus =
  | "needs_identification"
  | "conflict"
  | "insufficient_source"
  | "eligible_institution_source";

export interface ExtractedFactChangeInput {
  kind: FactChangeKind;
  phase?: "announced" | "completed" | null;
  namingStatus?: "proposed" | "official" | null;
  date?: string | null;
  motherName?: string | null;
  toPlace?: string | null;
}

export interface FactGateEvaluation {
  candidateKey: string;
  kind: Exclude<FactChangeKind, "none">;
  phase: "announced" | "completed" | undefined;
  namingStatus: "official" | undefined;
  eventDate: string | undefined;
  targetPandaId: string | undefined;
  targetPandaSlug: string | undefined;
  targetInstitutionId: string | undefined;
  targetInstitutionSlug: string | undefined;
  gateStatus: FactGateStatus;
  reviewState: "pending_review";
}

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const STALE_FACT_DAYS_MS = 30 * 24 * 60 * 60 * 1_000;

function slugToken(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "unknown";
}

function monthBucket(eventDate: string | undefined, publishedAtIso: string): string {
  const source = eventDate ?? publishedAtIso.slice(0, 10);
  const match = /^(\d{4}-\d{2})/.exec(source);
  return match?.[1] ?? "undated";
}

function latestResidencyStartOn(
  pandaId: string,
  residencies: readonly PublicResidencySummary[],
): string | undefined {
  let latest: string | undefined;
  for (const residency of residencies) {
    if (residency.pandaId !== pandaId || !residency.startOn) continue;
    if (latest === undefined || residency.startOn > latest) {
      latest = residency.startOn;
    }
  }
  return latest;
}

function existingDeathDate(panda: PublicPandaSummary): string | undefined {
  const fact = panda.facts.find((item) => item.fieldKey === "death_date");
  return typeof fact?.value === "string" ? fact.value : undefined;
}

function isDelayedOver30Days(eventDate: string | undefined, publishedAtIso: string): boolean {
  if (!eventDate || !FULL_DATE.test(eventDate)) return false;
  const eventMs = Date.parse(`${eventDate}T00:00:00Z`);
  const publishedMs = Date.parse(publishedAtIso);
  if (Number.isNaN(eventMs) || Number.isNaN(publishedMs)) return false;
  return publishedMs - eventMs > STALE_FACT_DAYS_MS;
}

/**
 * Evaluates a structured fact-change extraction according to ADR-0005 section 5.
 * During the first 30-day TestFlight rollout window, all non-trivial candidates
 * remain strictly locked in `reviewState = "pending_review"` for human confirmation.
 */
export function evaluateFactCandidate(input: {
  sourceTier: string;
  publishedAtIso: string;
  scope: string;
  factChange: ExtractedFactChangeInput | undefined;
  evidenceQuote: string | undefined;
  resolution: EntityResolutionResult;
  allPandas: readonly PublicPandaSummary[];
  allResidencies: readonly PublicResidencySummary[];
  rawPandaNames: readonly string[];
}): FactGateEvaluation | undefined {
  const fc = input.factChange;
  if (fc === undefined || fc.kind === "none" || input.scope !== "single") {
    return undefined;
  }
  if (fc.kind === "naming" && fc.namingStatus === "proposed") {
    return undefined;
  }

  const kind = fc.kind;
  const eventDate = fc.date ?? undefined;
  const resolvedPanda = input.resolution.pandas.length === 1 ? input.resolution.pandas[0] : undefined;
  const targetInst = input.resolution.toInstitution ?? input.resolution.institution;
  const pandaKey =
    resolvedPanda?.canonicalSlug ??
    (fc.motherName ? slugToken(fc.motherName) : slugToken(input.rawPandaNames[0] ?? "unknown"));
  const instKey = targetInst?.slug ?? "none";
  const candidateKey = `${kind}:${pandaKey}:${instKey}:${monthBucket(eventDate, input.publishedAtIso)}`;

  const phase = kind === "transfer" ? (fc.phase ?? undefined) : undefined;
  const namingStatus = kind === "naming" ? "official" : undefined;

  let gateStatus: FactGateStatus;
  const hasAmbiguity = input.resolution.ambiguousPandaNames.length > 0;
  const missingIdentity =
    hasAmbiguity ||
    (kind !== "birth" && resolvedPanda === undefined) ||
    (kind === "birth" && resolvedPanda === undefined && !fc.motherName) ||
    (kind === "transfer" && targetInst === undefined);

  let hasConflict = false;
  if (resolvedPanda !== undefined) {
    const publicPanda = input.allPandas.find((item) => item.pandaId === resolvedPanda.pandaId);
    if (publicPanda !== undefined && kind === "death" && eventDate !== undefined) {
      const priorDeath = existingDeathDate(publicPanda);
      if (priorDeath !== undefined && priorDeath !== eventDate) {
        hasConflict = true;
      }
    }
    if (kind === "transfer" && eventDate !== undefined && FULL_DATE.test(eventDate)) {
      const latestStart = latestResidencyStartOn(resolvedPanda.pandaId, input.allResidencies);
      if (latestStart !== undefined && eventDate < latestStart) {
        hasConflict = true;
      }
    }
  }

  if (hasConflict) {
    gateStatus = "conflict";
  } else if (missingIdentity) {
    gateStatus = "needs_identification";
  } else if (!input.evidenceQuote || isDelayedOver30Days(eventDate, input.publishedAtIso)) {
    gateStatus = "insufficient_source";
  } else if (input.sourceTier === "institution" && input.resolution.institution !== undefined) {
    const relatedInstId = input.resolution.institution.institutionId;
    const isLinkedToInst =
      resolvedPanda === undefined ||
      resolvedPanda.institutionIds.has(relatedInstId) ||
      targetInst?.institutionId === relatedInstId;
    gateStatus = isLinkedToInst ? "eligible_institution_source" : "insufficient_source";
  } else {
    gateStatus = "insufficient_source";
  }

  return {
    candidateKey,
    kind,
    phase,
    namingStatus,
    eventDate,
    targetPandaId: resolvedPanda?.pandaId,
    targetPandaSlug: resolvedPanda?.canonicalSlug,
    targetInstitutionId: targetInst?.institutionId,
    targetInstitutionSlug: targetInst?.slug,
    gateStatus,
    reviewState: "pending_review",
  };
}
