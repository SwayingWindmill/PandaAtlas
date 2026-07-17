import {
  TRUSTED_FACILITIES,
  TRUSTED_LINEAGE_EDGES,
  TRUSTED_LINEAGE_NODES,
  TRUSTED_PANDA_DETAILS,
  TRUSTED_PANDA_REFERENCES,
  TRUSTED_PARENTAGE_ASSERTIONS,
} from "@/lib/generated/trusted-identity-aliases";
import type {
  PandaDetail,
  PandaLineageRelationship,
  PandaLineageResponse,
  PublicFacilitySummary,
  PublicParentageAssertionSummary,
  PublicSourceSummary,
} from "@/lib/types";
import type { PublicLocale } from "@/foundation/content/locales";
import { publicLanguageTag } from "@/foundation/content/locales";

export type PublicDeliveryState = "live" | "cached" | "partial" | "unavailable";
export type PublicCoverageState = "complete" | "partial" | "none";
export type PublicTranslationState = "reviewed" | "missing";

export interface PublicReleaseIdentity {
  id: string;
  schemaVersion: string;
}

export interface PublicDelivery {
  state: PublicDeliveryState;
  label: "versioned-local-public-release";
  lastSuccessfulAt: string | null;
}

export interface PublicCoverage {
  state: PublicCoverageState;
  scope: string;
}

export interface PublicLocaleDelivery {
  requested: PublicLocale;
  available: PublicLocale[];
  translation: PublicTranslationState;
}

export interface PublicContentEnvelope<T> {
  data: T;
  release: PublicReleaseIdentity;
  delivery: PublicDelivery;
  coverage: PublicCoverage;
  locale: PublicLocaleDelivery;
  sources: PublicSourceSummary[];
}

export interface PublicAtlasResult {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string | null;
  nameEnTranslation: PublicTranslationState;
  status: PandaDetail["status"];
  birthDate: string | null;
  currentLocation: string | null;
}

export interface PublicAtlasSearch {
  query: string;
  results: PublicAtlasResult[];
  totalPublished: number;
}

export interface PublicAtlasDataset {
  pandas: PandaDetail[];
  facilities: PublicFacilitySummary[];
}

export interface PublicLineageDataset {
  nodes: PandaLineageResponse["nodes"];
  parentageAssertions: PublicParentageAssertionSummary[];
}

export interface PublicProfileRecord {
  panda: PandaDetail;
  facilities: PublicFacilitySummary[];
  lineage: PandaLineageResponse;
  parentageAssertions: PublicParentageAssertionSummary[];
}

const canonicalDetails = [...TRUSTED_PANDA_DETAILS].sort((left, right) =>
  left.name_zh.localeCompare(right.name_zh, "zh-CN"),
);

function normalizeSearchTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[\s_\-:]+/g, "")
    .trim();
}

function buildLineageRelationships(
  nodes: PandaLineageResponse["nodes"],
  edges: PandaLineageResponse["edges"],
): PandaLineageRelationship[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.parent_id) || !nodeIds.has(edge.child_id)) continue;
    parentsByChild.set(edge.child_id, [...(parentsByChild.get(edge.child_id) ?? []), edge.parent_id]);
    childrenByParent.set(edge.parent_id, [...(childrenByParent.get(edge.parent_id) ?? []), edge.child_id]);
  }

  const relationships = new Map<string, PandaLineageRelationship>();
  const add = (relationship: PandaLineageRelationship) => {
    const key = `${relationship.subject_id}:${relationship.kind}:${relationship.related_id}`;
    if (!relationships.has(key)) relationships.set(key, relationship);
  };

  for (const subject of nodes) {
    const parents = parentsByChild.get(subject.id) ?? [];
    const children = childrenByParent.get(subject.id) ?? [];
    for (const parentId of parents) {
      add({ subject_id: subject.id, related_id: parentId, kind: "parent", path: [subject.id, parentId] });
      for (const siblingId of childrenByParent.get(parentId) ?? []) {
        if (siblingId !== subject.id) {
          add({ subject_id: subject.id, related_id: siblingId, kind: "sibling", path: [subject.id, parentId, siblingId] });
        }
      }
      for (const grandparentId of parentsByChild.get(parentId) ?? []) {
        add({ subject_id: subject.id, related_id: grandparentId, kind: "grandparent", path: [subject.id, parentId, grandparentId] });
      }
    }
    for (const childId of children) {
      add({ subject_id: subject.id, related_id: childId, kind: "child", path: [subject.id, childId] });
    }
  }

  return [...relationships.values()];
}

function trustedLineageFor(panda: PandaDetail): PandaLineageResponse {
  return {
    focus_id: panda.id,
    nodes: TRUSTED_LINEAGE_NODES,
    edges: TRUSTED_LINEAGE_EDGES,
    relationships: buildLineageRelationships(TRUSTED_LINEAGE_NODES, TRUSTED_LINEAGE_EDGES),
    meta: { ancestor_depth: 8, descendant_depth: 8 },
  };
}

function releaseIdentity(detail: PandaDetail): PublicReleaseIdentity {
  return {
    id: detail.public_revision?.data_version ?? "unknown-public-release",
    schemaVersion: detail.public_revision?.public_schema_version ?? "unknown-public-schema",
  };
}

function lastSuccessfulAt(details: PandaDetail[]): string | null {
  const values = details.flatMap((detail) =>
    detail.sources.map((source) => source.last_verified_at).filter(Boolean),
  );
  return values.sort().at(-1) ?? null;
}

function localeDelivery(detail: PandaDetail, locale: PublicLocale): PublicLocaleDelivery {
  const requiredLocale = publicLanguageTag(locale);
  const available = detail.localized_content.flatMap((item) => {
    if (item.locale === "zh-CN") return ["zh" as const];
    if (item.locale === "en") return ["en" as const];
    return [];
  });

  return {
    requested: locale,
    available: [...new Set(available)],
    translation: detail.localized_content.some((item) => item.locale === requiredLocale)
      ? "reviewed"
      : "missing",
  };
}

function buildEnvelope<T>(
  data: T,
  details: PandaDetail[],
  locale: PublicLocale,
  coverage: PublicCoverage,
): PublicContentEnvelope<T> {
  const primary = details[0] ?? canonicalDetails[0];
  if (!primary) {
    throw new Error("The trusted public release contains no panda records.");
  }

  const sources = [...new Map(
    details.flatMap((detail) => detail.sources).map((source) => [source.id, source]),
  ).values()];

  return {
    data,
    release: releaseIdentity(primary),
    delivery: {
      state: "cached",
      label: "versioned-local-public-release",
      lastSuccessfulAt: lastSuccessfulAt(details),
    },
    coverage,
    locale: localeDelivery(primary, locale),
    sources,
  };
}

export function searchPublishedPandas(
  query: string,
  locale: PublicLocale,
): PublicContentEnvelope<PublicAtlasSearch> {
  const normalizedQuery = normalizeSearchTerm(query);
  const matches = normalizedQuery
    ? canonicalDetails.filter((detail) => {
        const terms = [
          detail.slug,
          detail.name_zh,
          detail.name_en ?? "",
          ...(detail.search_terms ?? []),
        ];
        return terms.some((term) => normalizeSearchTerm(term).includes(normalizedQuery));
      })
    : [];

  return buildEnvelope(
    {
      query,
      results: matches.map((detail) => ({
        id: detail.id,
        slug: detail.slug,
        nameZh: detail.name_zh,
        nameEn: detail.name_en,
        nameEnTranslation: detail.name_en ? "reviewed" : "missing",
        status: detail.status,
        birthDate: detail.birth_date,
        currentLocation: detail.current_place?.coarse_location ?? detail.current_location,
      })),
      totalPublished: canonicalDetails.length,
    },
    matches.length ? matches : canonicalDetails,
    locale,
    {
      state: normalizedQuery ? "complete" : "none",
      scope: "reviewed identity records in the versioned public release",
    },
  );
}

export function loadPublishedAtlasDataset(
  locale: PublicLocale,
): PublicContentEnvelope<PublicAtlasDataset> {
  return buildEnvelope(
    {
      pandas: canonicalDetails,
      facilities: TRUSTED_FACILITIES,
    },
    canonicalDetails,
    locale,
    {
      state: "complete",
      scope: "all reviewed panda identity records in the versioned public release",
    },
  );
}

export function loadPublishedLineageDataset(
  locale: PublicLocale,
): PublicContentEnvelope<PublicLineageDataset> {
  return buildEnvelope(
    {
      nodes: TRUSTED_LINEAGE_NODES,
      parentageAssertions: TRUSTED_PARENTAGE_ASSERTIONS,
    },
    canonicalDetails,
    locale,
    {
      state: "complete",
      scope: "reviewed lineage identities and published parentage assertions",
    },
  );
}

export function resolvePublishedPandaReference(input: string): { id: string; slug: string } | null {
  const normalized = input.trim();
  if (!normalized) return null;

  const direct = TRUSTED_PANDA_REFERENCES[normalized];
  if (direct) return direct;

  const detail = canonicalDetails.find(
    (candidate) => candidate.id === normalized || candidate.slug === normalized,
  );
  return detail ? { id: detail.id, slug: detail.slug } : null;
}

export function loadPublishedPandaProfile(
  input: string,
  locale: PublicLocale,
): PublicContentEnvelope<PublicProfileRecord> | null {
  const reference = resolvePublishedPandaReference(input);
  if (!reference) return null;

  const panda = canonicalDetails.find((detail) => detail.id === reference.id);
  if (!panda?.identity || !panda.public_revision || panda.sources.length === 0) return null;

  return buildEnvelope(
    {
      panda,
      facilities: TRUSTED_FACILITIES,
      lineage: trustedLineageFor(panda),
      parentageAssertions: TRUSTED_PARENTAGE_ASSERTIONS,
    },
    [panda],
    locale,
    {
      state: panda.record_tier === "complete_first_pass" ? "complete" : "partial",
      scope: panda.record_tier === "complete_first_pass"
        ? "trusted profile identity, reviewed facts and public source summaries"
        : "reviewed identity and the currently published subset of profile facts",
    },
  );
}

export function listPublishedPandas(): readonly PandaDetail[] {
  return canonicalDetails;
}
