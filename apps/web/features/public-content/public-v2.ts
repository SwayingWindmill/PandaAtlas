import "server-only";

import type { components } from "@zhipanda/api-client";

export type { PublicCoverage } from "@/features/public-content/public-release";

import type {
  PublicAtlasDataset,
  PublicAtlasSearch,
  PublicContentEnvelope,
  PublicCoverage,
  PublicLineageDataset,
  PublicMapDataset,
  PublicPlaceRecord,
  PublicProfileRecord,
} from "@/features/public-content/public-release";
import type { MomentQuery, PublicMomentOccurrence } from "@/features/public-experiences/data";
import type { PublicLocale } from "@/foundation/content/locales";
import { publicMediaUrl } from "@/lib/media/public-media";
import { createServerV2Client } from "@/lib/server/v2-api";
import type {
  PandaDetail,
  PandaLineageRelationship,
  PandaLineageResponse,
  PublicFacilitySummary,
  PublicInstitutionSummary,
  PublicParentageAssertionSummary,
  PublicPlaceSummary,
  PublicSourceSummary,
} from "@/lib/types";

type V2Release = components["schemas"]["PublicReadReleaseDto"];
type V2Panda = components["schemas"]["PublicPandaSummaryDto"];
type V2PandaDetail = components["schemas"]["PublicPandaDetailDto"];
type V2Place = components["schemas"]["PublicPlaceSummaryDto"];
type V2Residency = components["schemas"]["PublicResidencySummaryDto"];
type V2Event = components["schemas"]["PublicLifeEventSummaryDto"];
type V2Lineage = components["schemas"]["PublicLineageSummaryDto"];
type V2Evidence = components["schemas"]["PublicEvidenceSummaryDto"];
type V2Media = components["schemas"]["PublicMediaSummaryDto"];

interface V2CoreDataset {
  release: V2Release;
  pandas: V2Panda[];
  places: V2Place[];
  residencies: V2Residency[];
  events: V2Event[];
  lineage: V2Lineage[];
}

export interface V2MomentDataset {
  release: V2Release;
  pandas: PandaDetail[];
  places: PublicPlaceSummary[];
  sourceEvents: PublicMomentOccurrence[];
}

export interface V2MomentResult {
  release: V2Release;
  pandas: PandaDetail[];
  items: PublicMomentOccurrence[];
}

export interface V2MomentQuery extends MomentQuery {
  location?: string;
}

function normalizeSearchTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[\s_\-:]+/g, "")
    .trim();
}

function factFor(panda: V2Panda, ...fieldKeys: string[]) {
  const wanted = new Set(fieldKeys);
  return panda.facts.find((fact) => wanted.has(fact.fieldKey));
}

function textFact(panda: V2Panda, ...fieldKeys: string[]): string | null {
  const value = factFor(panda, ...fieldKeys)?.value;
  return typeof value === "string" && value.trim() ? value : null;
}

function primaryName(panda: V2Panda, locale: "zh" | "en"): string | null {
  const languageMatches = locale === "zh"
    ? new Set(["zh", "zh-CN", "zh-Hans", "zh-Hant"])
    : new Set(["en", "en-US", "en-GB"]);
  return panda.names.find((name) => name.isPrimary && languageMatches.has(name.languageTag))?.value
    ?? panda.names.find((name) => languageMatches.has(name.languageTag))?.value
    ?? null;
}

function pandaSex(panda: V2Panda): PandaDetail["gender"] {
  const value = textFact(panda, "identity.sex", "sex")?.toLocaleLowerCase();
  if (value === "male" || value === "female") return value;
  return "unknown";
}

function pandaStatus(panda: V2Panda): PandaDetail["status"] {
  const value = textFact(panda, "life_status", "identity.life_status", "status")?.toLocaleLowerCase();
  if (value === "alive" || value === "deceased" || value === "unknown") return value;
  return textFact(panda, "identity.death_date", "death_date") ? "deceased" : "unknown";
}

function placeNames(place: V2Place) {
  return [
    ...(place.nameZh ? [{ language: "zh-Hans", value: place.nameZh, kind: "official" }] : []),
    ...(place.nameEn ? [{ language: "en", value: place.nameEn, kind: "official" }] : []),
  ];
}

function mapPlace(place: V2Place): PublicPlaceSummary {
  return {
    id: place.placeId,
    canonical_slug: place.slug,
    legacy_slugs: [],
    names: placeNames(place),
    country_code: place.countryCode ?? null,
    locality: place.region ?? null,
    precision: place.region ? "locality" : "country",
    place_type: place.placeType,
    facility_ids: [place.placeId],
    institution_ids: place.institutionId ? [place.institutionId] : [],
    source_ids: [],
    last_verified_at: null,
    revision_summaries: [],
  };
}

function mapFacility(place: V2Place): PublicFacilitySummary {
  return {
    id: place.placeId,
    canonical_slug: place.slug,
    legacy_slugs: [],
    names: placeNames(place),
    institution_type: place.placeType,
    facility_ids: [place.placeId],
    place_ids: [place.placeId],
    source_ids: [],
    last_verified_at: null,
    revision_summaries: [],
    country_code: place.countryCode ?? null,
    locality: place.region ?? null,
    facility_type: place.placeType,
  };
}

function normalizeResidencyStatus(status: string): PandaDetail["residencies"][number]["status"] {
  if (status === "provisional") return "provisional";
  if (status === "confirmed_country_level") return "confirmed_country_level";
  return "confirmed";
}

function normalizeDatePrecision(value: string | undefined): "day" | "month" | "year" {
  return value === "month" || value === "year" ? value : "day";
}

function normalizeEventType(value: string): PandaDetail["events"][number]["event_type"] {
  const allowed = new Set([
    "birth",
    "arrival",
    "transfer",
    "return",
    "naming",
    "public_debut",
    "selection",
    "announcement",
    "observation",
    "death",
  ]);
  return allowed.has(value)
    ? value as PandaDetail["events"][number]["event_type"]
    : "observation";
}

function normalizeEventStatus(value: string): PandaDetail["events"][number]["event_status"] {
  if (value === "completed" || value === "cancelled" || value === "disputed") return value;
  return "announced";
}

function mapSource(source: V2Evidence): PublicSourceSummary {
  return {
    id: source.sourceId,
    publisher: source.publisher,
    title: source.title,
    url: source.url,
    published_at: source.publishedOn ?? null,
    last_verified_at: source.lastVerifiedOn,
    language: source.languageTag,
    access_state: source.accessState,
    evidence_tier: source.evidenceTier ?? null,
  };
}

function mapMedia(media: V2Media, evidenceById: Map<string, V2Evidence>): PandaDetail["media"][number] {
  const source = media.sourceId ? evidenceById.get(media.sourceId) : undefined;
  return {
    id: media.assetId,
    panda_id: media.pandaId,
    url: publicMediaUrl(media.objectKey),
    source_url: source?.url ?? null,
    rights: media.license ?? media.copyrightText ?? null,
    credit: media.attributionText ?? media.creator ?? null,
    alt_zh: media.title ?? null,
    alt_en: media.title ?? null,
    status: "available",
    sha256: media.contentSha256,
    mime_type: media.mediaType,
    width: null,
    height: null,
    bytes: null,
    derivatives: [],
    source_ids: media.sourceId ? [media.sourceId] : [],
    title: media.title ?? null,
    photographer: media.creator ?? null,
  };
}

function buildPanda(
  panda: V2Panda,
  placesById: Map<string, V2Place>,
  residencies: V2Residency[],
  events: V2Event[],
  lineage: V2Lineage[],
  release: V2Release,
  media: V2Media[] = [],
  evidence: V2Evidence[] = [],
): PandaDetail {
  const pandaResidencies = residencies.filter((item) => item.pandaId === panda.pandaId && item.startOn);
  const currentResidency = pandaResidencies.find((item) => !item.endOn) ?? null;
  const currentPlace = currentResidency ? placesById.get(currentResidency.placeId) ?? null : null;
  const pandaEvents = events.filter((event) => event.participantIds.includes(panda.pandaId) && event.occurredOn);
  const fatherId = lineage.find((item) => item.childId === panda.pandaId && item.parentRole === "father")?.parentId ?? null;
  const motherId = lineage.find((item) => item.childId === panda.pandaId && item.parentRole === "mother")?.parentId ?? null;
  const names = panda.names.map((name) => ({
    value: name.value,
    language: name.languageTag,
    kind: name.nameKind,
    primary: name.isPrimary,
    source_ids: [],
  }));
  const evidenceById = new Map(evidence.map((item) => [item.sourceId, item]));
  const mappedMedia = media.map((item) => mapMedia(item, evidenceById));
  const birthDate = textFact(panda, "identity.birth_date", "birth_date");
  const nameZh = primaryName(panda, "zh") ?? primaryName(panda, "en") ?? panda.canonicalSlug;
  const nameEn = primaryName(panda, "en");
  const currentLocation = currentPlace?.region ?? currentPlace?.countryCode ?? null;

  return {
    id: panda.pandaId,
    slug: panda.canonicalSlug,
    name_zh: nameZh,
    name_en: nameEn,
    gender: pandaSex(panda),
    status: pandaStatus(panda),
    birth_date: birthDate,
    current_location: currentLocation,
    cover_image_url: mappedMedia[0]?.url ?? null,
    search_terms: [panda.canonicalSlug, ...panda.legacySlugs, ...panda.names.map((name) => name.value)],
    intro: null,
    birthplace: null,
    tags: [],
    father_id: fatherId,
    mother_id: motherId,
    habitats: [],
    media: mappedMedia,
    identity: {
      stable_id: panda.pandaId,
      canonical_slug: panda.canonicalSlug,
      names,
      aliases: names.filter((name) => !name.primary),
      legacy_slugs: panda.legacySlugs.map((value) => ({ value, source_ids: [] })),
      external_identifiers: [],
    },
    conclusions: panda.facts.map((fact) => ({
      field: fact.fieldKey.startsWith("identity.") ? fact.fieldKey.slice("identity.".length) : fact.fieldKey,
      value: fact.value ?? null,
      status: fact.status === "provisional" || fact.status === "disputed" ? fact.status : "confirmed",
      last_verified_at: fact.lastVerifiedOn,
      assertion_ids: [],
      source_ids: [],
      candidate_values: [],
      superseded_values: [],
    })),
    sources: evidence.map(mapSource),
    current_place: currentResidency
      ? {
          facility_id: currentResidency.placeId,
          coarse_location: currentLocation,
          status: normalizeResidencyStatus(currentResidency.status),
          last_verified_at: null,
        }
      : null,
    residencies: pandaResidencies.map((residency) => {
      const place = placesById.get(residency.placeId);
      return {
        id: residency.residencyId,
        facility_id: residency.placeId,
        coarse_location: place?.region ?? place?.countryCode ?? null,
        status: normalizeResidencyStatus(residency.status),
        last_verified_at: null,
        residency_type: residency.residencyType as PandaDetail["residencies"][number]["residency_type"],
        start_date: residency.startOn!,
        start_precision: normalizeDatePrecision(residency.startPrecision),
        end_date: residency.endOn ?? null,
        end_precision: residency.endOn ? normalizeDatePrecision(residency.endPrecision) : null,
        source_ids: residency.sourceIds,
      };
    }),
    events: pandaEvents.map((event) => ({
      id: event.eventId,
      event_type: normalizeEventType(event.eventType),
      event_status: normalizeEventStatus(event.eventStatus),
      event_date: event.occurredOn!,
      event_date_precision: normalizeDatePrecision(event.occurredPrecision),
      participants: event.participantIds,
      from_facility_id: event.fromPlaceId ?? null,
      from_coarse_location: event.fromPlaceId
        ? placesById.get(event.fromPlaceId)?.region ?? placesById.get(event.fromPlaceId)?.countryCode ?? null
        : null,
      to_facility_id: event.toPlaceId ?? null,
      to_coarse_location: event.toPlaceId
        ? placesById.get(event.toPlaceId)?.region ?? placesById.get(event.toPlaceId)?.countryCode ?? null
        : null,
      source_ids: event.sourceIds,
      changes_current_residency: ["arrival", "transfer", "return"].includes(event.eventType),
    })),
    record_tier: null,
    localized_content: [],
    media_release: {
      license_state: mappedMedia.length ? "licensed" : "no_licensed_media",
      display_mode: mappedMedia.length ? "gallery" : "designed_empty_state",
      source_ids: [...new Set(mappedMedia.flatMap((item) => item.source_ids))],
    },
    public_revision: {
      data_version: release.version,
      public_schema_version: "v2",
      summaries: [],
    },
  };
}

function buildRelationships(
  nodes: PandaLineageResponse["nodes"],
  assertions: V2Lineage[],
): PandaLineageRelationship[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  for (const assertion of assertions) {
    if (!nodeIds.has(assertion.childId) || !nodeIds.has(assertion.parentId)) continue;
    parentsByChild.set(assertion.childId, [...(parentsByChild.get(assertion.childId) ?? []), assertion.parentId]);
    childrenByParent.set(assertion.parentId, [...(childrenByParent.get(assertion.parentId) ?? []), assertion.childId]);
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
        if (siblingId !== subject.id) add({ subject_id: subject.id, related_id: siblingId, kind: "sibling", path: [subject.id, parentId, siblingId] });
      }
      for (const grandparentId of parentsByChild.get(parentId) ?? []) {
        add({ subject_id: subject.id, related_id: grandparentId, kind: "grandparent", path: [subject.id, parentId, grandparentId] });
      }
    }
    for (const childId of children) add({ subject_id: subject.id, related_id: childId, kind: "child", path: [subject.id, childId] });
  }
  return [...relationships.values()];
}

function parentageAssertions(lineage: V2Lineage[]): PublicParentageAssertionSummary[] {
  return lineage.map((item) => ({
    id: item.assertionId,
    child_id: item.childId,
    parent_id: item.parentId,
    role: item.parentRole,
    status: "confirmed",
    source_ids: item.sourceIds,
  }));
}

function localeDelivery(pandas: V2Panda[], locale: PublicLocale) {
  const hasZh = pandas.some((panda) => Boolean(primaryName(panda, "zh")));
  const hasEn = pandas.some((panda) => Boolean(primaryName(panda, "en")));
  return {
    requested: locale,
    available: [
      ...(hasZh ? ["zh" as const] : []),
      ...(hasEn ? ["en" as const] : []),
    ],
    translation: locale === "zh" ? (hasZh ? "reviewed" as const : "missing" as const) : (hasEn ? "reviewed" as const : "missing" as const),
  };
}

function v2Envelope<T>(
  data: T,
  release: V2Release,
  pandas: V2Panda[],
  coverage: PublicCoverage,
  locale: PublicLocale,
  sources: PublicSourceSummary[] = [],
): PublicContentEnvelope<T> {
  const verified = pandas.flatMap((panda) => panda.facts.map((fact) => fact.lastVerifiedOn)).sort().at(-1) ?? null;
  return {
    data,
    release: { id: release.version, schemaVersion: "v2" },
    delivery: { state: "live", label: "generated-v2-public-read", lastSuccessfulAt: verified },
    coverage,
    locale: localeDelivery(pandas, locale),
    sources,
  };
}

async function loadCore(): Promise<V2CoreDataset | null> {
  const client = createServerV2Client();
  const [pandas, places, residencies, events, lineage] = await Promise.all([
    client.GET("/api/v2/pandas"),
    client.GET("/api/v2/places"),
    client.GET("/api/v2/residencies"),
    client.GET("/api/v2/life-events"),
    client.GET("/api/v2/lineage"),
  ]);
  if (!pandas.data || !places.data || !residencies.data || !events.data || !lineage.data) return null;
  return {
    release: pandas.data.release,
    pandas: pandas.data.items,
    places: places.data.items,
    residencies: residencies.data.items,
    events: events.data.items,
    lineage: lineage.data.items,
  };
}

function buildCorePandas(core: V2CoreDataset): PandaDetail[] {
  const placesById = new Map(core.places.map((place) => [place.placeId, place]));
  return core.pandas.map((panda) => buildPanda(
    panda,
    placesById,
    core.residencies,
    core.events,
    core.lineage,
    core.release,
  ));
}

export async function loadV2PublicAtlasDataset(locale: PublicLocale): Promise<PublicContentEnvelope<PublicAtlasDataset> | null> {
  const core = await loadCore();
  if (!core) return null;
  const pandas = buildCorePandas(core);
  const places = core.places.map(mapPlace);
  return v2Envelope(
    { pandas, facilities: core.places.map(mapFacility), institutions: [] as PublicInstitutionSummary[], places },
    core.release,
    core.pandas,
    { state: "complete", scope: "canonical V2 public pandas, places, residencies, life events, and lineage" },
    locale,
  );
}

export async function loadV2PublicMapDataset(locale: PublicLocale): Promise<PublicContentEnvelope<PublicMapDataset> | null> {
  return loadV2PublicAtlasDataset(locale);
}

export async function loadV2PublicLineageDataset(locale: PublicLocale): Promise<PublicContentEnvelope<PublicLineageDataset> | null> {
  const core = await loadCore();
  if (!core) return null;
  const pandas = buildCorePandas(core);
  return v2Envelope(
    { nodes: pandas, parentageAssertions: parentageAssertions(core.lineage) },
    core.release,
    core.pandas,
    { state: "complete", scope: "canonical V2 public lineage assertions and panda identities" },
    locale,
  );
}

export async function searchV2PublicPandas(query: string, locale: PublicLocale): Promise<PublicContentEnvelope<PublicAtlasSearch> | null> {
  const core = await loadCore();
  if (!core) return null;
  const pandas = buildCorePandas(core);
  const normalizedQuery = normalizeSearchTerm(query);
  const matches = normalizedQuery
    ? pandas.filter((panda) => [panda.slug, panda.name_zh, panda.name_en ?? "", ...(panda.search_terms ?? [])]
        .some((term) => normalizeSearchTerm(term).includes(normalizedQuery)))
    : [];
  return v2Envelope(
    {
      query,
      results: matches.map((panda) => ({
        id: panda.id,
        slug: panda.slug,
        nameZh: panda.name_zh,
        nameEn: panda.name_en,
        nameEnTranslation: panda.name_en ? "reviewed" : "missing",
        status: panda.status,
        birthDate: panda.birth_date,
        currentLocation: panda.current_place?.coarse_location ?? panda.current_location,
      })),
      totalPublished: pandas.length,
    },
    core.release,
    core.pandas,
    { state: normalizedQuery ? "complete" : "none", scope: "canonical V2 public panda identities" },
    locale,
  );
}

export async function resolveV2PublicPandaReference(input: string): Promise<{ id: string; slug: string } | null> {
  const client = createServerV2Client();
  const result = await client.GET("/api/v2/pandas");
  if (!result.data) return null;
  const normalized = input.trim();
  const panda = result.data.items.find((item) =>
    item.pandaId === normalized || item.canonicalSlug === normalized || item.legacySlugs.includes(normalized),
  );
  return panda ? { id: panda.pandaId, slug: panda.canonicalSlug } : null;
}

export async function loadV2PublicPandaProfile(
  input: string,
  locale: PublicLocale,
): Promise<PublicContentEnvelope<PublicProfileRecord> | null> {
  const client = createServerV2Client();
  const [detailResult, pandasResult, placesResult, lineageResult] = await Promise.all([
    client.GET("/api/v2/pandas/{slug}", { params: { path: { slug: input } } }),
    client.GET("/api/v2/pandas"),
    client.GET("/api/v2/places"),
    client.GET("/api/v2/lineage"),
  ]);
  if (!detailResult.data || !pandasResult.data || !placesResult.data || !lineageResult.data) return null;
  const detail: V2PandaDetail = detailResult.data;
  const placesById = new Map(placesResult.data.items.map((place) => [place.placeId, place]));
  const panda = buildPanda(
    detail.panda,
    placesById,
    detail.residencies,
    detail.events,
    lineageResult.data.items,
    detail.release,
    detail.media,
    detail.evidence,
  );
  const allNodes = pandasResult.data.items.map((item) => buildPanda(
    item,
    placesById,
    [],
    [],
    lineageResult.data.items,
    detail.release,
  ));
  const edges = lineageResult.data.items.map((item) => ({ parent_id: item.parentId, child_id: item.childId }));
  const lineage: PandaLineageResponse = {
    focus_id: panda.id,
    nodes: allNodes,
    edges,
    relationships: buildRelationships(allNodes, lineageResult.data.items),
    meta: { ancestor_depth: 8, descendant_depth: 8 },
  };
  const sources = detail.evidence.map(mapSource);
  return v2Envelope(
    {
      panda,
      institutions: [],
      places: placesResult.data.items.map(mapPlace),
      facilities: placesResult.data.items.map(mapFacility),
      lineage,
      parentageAssertions: parentageAssertions(lineageResult.data.items),
    },
    detail.release,
    pandasResult.data.items,
    { state: "complete", scope: "canonical V2 public panda profile, lineage, residencies, life events, media, and evidence" },
    locale,
    sources,
  );
}

export async function resolveV2PublicPlaceReference(input: string): Promise<{ id: string; slug: string } | null> {
  const client = createServerV2Client();
  const result = await client.GET("/api/v2/places");
  if (!result.data) return null;
  const normalized = input.trim();
  const place = result.data.items.find((item) => item.placeId === normalized || item.slug === normalized);
  return place ? { id: place.placeId, slug: place.slug } : null;
}

export async function loadV2PublicPlace(
  input: string,
  locale: PublicLocale,
): Promise<PublicContentEnvelope<PublicPlaceRecord> | null> {
  const core = await loadCore();
  if (!core) return null;
  const place = core.places.find((item) => item.placeId === input || item.slug === input);
  if (!place) return null;
  const pandas = buildCorePandas(core).filter((panda) =>
    panda.residencies.some((residency) => residency.facility_id === place.placeId)
      || panda.events.some((event) => event.from_facility_id === place.placeId || event.to_facility_id === place.placeId),
  );
  return v2Envelope(
    { place: mapPlace(place), institutions: [], pandas },
    core.release,
    core.pandas,
    { state: "partial", scope: "canonical V2 public place identity, panda residencies, and life events; institution detail is not published by V2" },
    locale,
  );
}

function sourceOccurrence(event: PandaDetail["events"][number], pandasById: Map<string, PandaDetail>): PublicMomentOccurrence {
  return {
    id: event.id,
    occurrenceKind: "source_event",
    eventType: event.event_type,
    eventStatus: event.event_status,
    occurrenceDate: event.event_date,
    sourceEventId: event.id,
    anniversaryYear: null,
    participants: event.participants.map((id) => pandasById.get(id)).filter((panda): panda is PandaDetail => Boolean(panda)),
    sourceIds: event.source_ids,
    fromFacilityId: event.from_facility_id,
    fromCoarseLocation: event.from_coarse_location,
    toFacilityId: event.to_facility_id,
    toCoarseLocation: event.to_coarse_location,
  };
}

function anniversaryOccurrence(
  occurrence: PublicMomentOccurrence,
  targetYear: number,
): PublicMomentOccurrence | null {
  if (occurrence.eventType !== "birth") return null;
  const sourceDate = new Date(`${occurrence.occurrenceDate}T00:00:00Z`);
  if (targetYear <= sourceDate.getUTCFullYear()) return null;
  const month = sourceDate.getUTCMonth();
  const day = sourceDate.getUTCDate();
  const candidate = new Date(Date.UTC(targetYear, month, day));
  const occurrenceDate = candidate.getUTCMonth() === month ? candidate.toISOString().slice(0, 10) : `${targetYear}-02-28`;
  return {
    ...occurrence,
    id: `anniversary:${occurrence.id}:${targetYear}`,
    occurrenceKind: "derived_anniversary",
    eventType: "birth_anniversary",
    eventStatus: "derived",
    occurrenceDate,
    anniversaryYear: targetYear,
  };
}

export async function loadV2PublicMomentDataset(): Promise<V2MomentDataset | null> {
  const core = await loadCore();
  if (!core) return null;
  const pandas = buildCorePandas(core);
  const pandasById = new Map(pandas.map((panda) => [panda.id, panda]));
  const eventMap = new Map<string, PandaDetail["events"][number]>();
  for (const panda of pandas) for (const event of panda.events) eventMap.set(event.id, event);
  return {
    release: core.release,
    pandas,
    places: core.places.map(mapPlace),
    sourceEvents: [...eventMap.values()].map((event) => sourceOccurrence(event, pandasById)),
  };
}

function matchesMomentLocation(item: PublicMomentOccurrence, location: string): boolean {
  if (location.startsWith("facility:")) {
    const facilityId = location.slice("facility:".length);
    return item.fromFacilityId === facilityId || item.toFacilityId === facilityId;
  }
  if (location.startsWith("coarse:")) {
    const coarseLocation = location.slice("coarse:".length);
    return item.fromCoarseLocation === coarseLocation || item.toCoarseLocation === coarseLocation;
  }
  return item.fromFacilityId === location
    || item.toFacilityId === location
    || item.fromCoarseLocation === location
    || item.toCoarseLocation === location;
}

export function filterV2PublicMoments(
  dataset: V2MomentDataset,
  query: V2MomentQuery = {},
): PublicMomentOccurrence[] {
  const targetYear = query.year ?? new Date().getUTCFullYear();
  let items = [...dataset.sourceEvents];
  if (query.includeAnniversaries) {
    items.push(
      ...dataset.sourceEvents
        .map((item) => anniversaryOccurrence(item, targetYear))
        .filter((item): item is PublicMomentOccurrence => Boolean(item)),
    );
  }
  if (query.year) items = items.filter((item) => Number(item.occurrenceDate.slice(0, 4)) === query.year);
  if (query.month) items = items.filter((item) => Number(item.occurrenceDate.slice(5, 7)) === query.month);
  if (query.panda) {
    const selected = dataset.pandas.find(
      (panda) => panda.id === query.panda || panda.slug === query.panda || panda.search_terms?.includes(query.panda!),
    );
    items = selected ? items.filter((item) => item.participants.some((participant) => participant.id === selected.id)) : [];
  }
  if (query.eventType) items = items.filter((item) => item.eventType === query.eventType);
  if (query.location) items = items.filter((item) => matchesMomentLocation(item, query.location!));
  items.sort((left, right) => {
    const compared = left.occurrenceDate.localeCompare(right.occurrenceDate) || left.id.localeCompare(right.id);
    return query.sort === "date_desc" ? -compared : compared;
  });
  return items;
}

export async function listV2PublicMoments(query: V2MomentQuery = {}): Promise<V2MomentResult | null> {
  const dataset = await loadV2PublicMomentDataset();
  if (!dataset) return null;
  return {
    release: dataset.release,
    pandas: dataset.pandas,
    items: filterV2PublicMoments(dataset, query),
  };
}
