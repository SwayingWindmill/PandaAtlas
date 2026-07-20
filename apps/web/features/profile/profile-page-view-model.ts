import type { PublicLocale } from "@/foundation/content/locales";
import { publicLanguageTag } from "@/foundation/content/locales";
import type { PublicProfileRecord, PublicTranslationState } from "@/features/public-content/public-release";
import type {
  PandaDetail,
  PandaLineageNode,
  PublicFactConclusion,
  PublicFacilitySummary,
  PublicParentageStatus,
  PublicSourceSummary,
} from "@/lib/types";

export type ProfileModuleState = "complete" | "partial" | "empty" | "unavailable";
export type ProfileSourceAccessState = "accessible" | "changed" | "restricted" | "unavailable";
export type ProfileMediaState = "gallery" | "no_licensed_media" | "source_link_only" | "unavailable";

export interface TrustedProfileFactViewModel {
  field: "life_status" | "birth_date" | "sex" | "current_coarse_location";
  value: unknown | null;
  status: PublicFactConclusion["status"] | "unknown";
  lastVerifiedAt: string | null;
  sourceIds: string[];
  precision: "day" | "country" | "categorical" | "unknown";
  candidateValues: unknown[];
  supersededValues: unknown[];
}

export interface TrustedProfileIdentityReferenceViewModel {
  value: string;
  kind: string;
  sourceIds: string[];
}

export interface TrustedProfileRelationViewModel {
  assertionId: string | null;
  id: string;
  slug: string;
  name: string;
  nameLanguage: "zh-CN" | "en";
  relation: "father" | "mother" | "child" | "sibling" | "grandparent";
  status: PublicParentageStatus | "confirmed";
  sourceIds: string[];
  href: string | null;
  profileAvailable: boolean;
}

export interface TrustedProfileTimelineItemViewModel {
  id: string;
  date: string;
  datePrecision: "day" | "month" | "year";
  kind: "residency" | "transfer";
  status: string;
  fromLabel: string | null;
  toLabel: string;
  endDate: string | null;
  endPrecision: "day" | "month" | "year" | null;
  sourceIds: string[];
  changesCurrentResidency: boolean;
}

export interface TrustedProfileFootprintStopViewModel {
  id: string;
  label: string;
  status: PandaDetail["residencies"][number]["status"];
  residencyType: PandaDetail["residencies"][number]["residency_type"];
  startDate: string;
  startPrecision: PandaDetail["residencies"][number]["start_precision"];
  endDate: string | null;
  endPrecision: PandaDetail["residencies"][number]["end_precision"];
  lastVerifiedAt: string | null;
  sourceIds: string[];
  current: boolean;
  entityHref: string | null;
}

export interface TrustedProfileSourceViewModel {
  id: string;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string | null;
  lastVerifiedAt: string;
  language: string;
  accessState: ProfileSourceAccessState;
  rawAccessState: string;
}

export interface TrustedProfileStoryViewModel {
  state: "reviewed" | "unavailable";
  paragraphs: string[];
}

export interface TrustedProfileMediaDerivativeViewModel {
  url: string;
  width: number;
}

export interface TrustedProfileMediaItemViewModel {
  id: string;
  url: string | null;
  sourceUrl: string | null;
  rights: string | null;
  credit: string | null;
  alt: string;
  status: PandaDetail["media"][number]["status"];
  width: number | null;
  height: number | null;
  derivatives: TrustedProfileMediaDerivativeViewModel[];
}

export interface TrustedProfileMediaViewModel {
  state: ProfileMediaState;
  sourceIds: string[];
  items: TrustedProfileMediaItemViewModel[];
}

export interface TrustedProfileRevisionViewModel {
  state: "reviewed" | "partial" | "unavailable";
  dataVersion: string | null;
  publicSchemaVersion: string | null;
  summary: string | null;
}

export interface TrustedProfilePageViewModel {
  stableId: string;
  canonicalSlug: string;
  displayName: string;
  displayNameLanguage: "zh-CN" | "en";
  displayNameTranslation: PublicTranslationState;
  alternateName: string | null;
  pinyin: string | null;
  summary: string | null;
  recordTier: string | null;
  lastVerifiedAt: string | null;
  identityReferences: TrustedProfileIdentityReferenceViewModel[];
  facts: TrustedProfileFactViewModel[];
  currentPlace: {
    label: string;
    status: NonNullable<PandaDetail["current_place"]>["status"] | "unknown";
    lastVerifiedAt: string | null;
  };
  story: TrustedProfileStoryViewModel;
  timeline: {
    state: ProfileModuleState;
    items: TrustedProfileTimelineItemViewModel[];
  };
  family: {
    state: ProfileModuleState;
    parents: TrustedProfileRelationViewModel[];
    children: TrustedProfileRelationViewModel[];
    related: TrustedProfileRelationViewModel[];
  };
  footprint: {
    state: ProfileModuleState;
    stops: TrustedProfileFootprintStopViewModel[];
  };
  media: TrustedProfileMediaViewModel;
  sources: TrustedProfileSourceViewModel[];
  revision: TrustedProfileRevisionViewModel;
  atlasHref: string;
  alternateLanguageHref: string;
}

function conclusionFor(panda: PandaDetail, field: string): PublicFactConclusion | undefined {
  const aliases = field === "current_coarse_location"
    ? new Set(["current_coarse_location", "current_facility"])
    : new Set([field]);
  return panda.conclusions.find((conclusion) => aliases.has(conclusion.field));
}

function fact(
  panda: PandaDetail,
  field: TrustedProfileFactViewModel["field"],
  fallback: unknown | null,
  precision: TrustedProfileFactViewModel["precision"],
): TrustedProfileFactViewModel {
  const conclusion = conclusionFor(panda, field);
  return {
    field,
    value: conclusion?.value ?? fallback,
    status: conclusion?.status ?? "unknown",
    lastVerifiedAt: conclusion?.last_verified_at ?? null,
    sourceIds: conclusion?.source_ids ?? [],
    precision,
    candidateValues: conclusion?.candidate_values ?? [],
    supersededValues: conclusion?.superseded_values ?? [],
  };
}

function displayName(node: PandaLineageNode, locale: PublicLocale): { value: string; language: "zh-CN" | "en" } {
  if (locale === "en" && node.name_en) return { value: node.name_en, language: "en" };
  if (locale === "zh" && node.name_zh !== node.slug) {
    return { value: node.name_zh, language: "zh-CN" };
  }
  if (node.name_en) return { value: node.name_en, language: "en" };
  return { value: node.name_zh, language: "zh-CN" };
}

function facilityName(
  facilityId: string | null,
  coarseLocation: string | null,
  fallback: string | null,
  facilities: PublicFacilitySummary[],
  locale: PublicLocale,
): string {
  if (facilityId) {
    const facility = facilities.find((item) => item.id === facilityId);
    const language = locale === "zh" ? "zh-Hans" : "en";
    const localized = facility?.names.find((name) => name.language === language)?.value;
    const other = facility?.names.find((name) => name.language !== language)?.value;
    if (localized || other) return localized ?? other!;
  }
  if (coarseLocation === "China") return locale === "zh" ? "中国" : "China";
  return coarseLocation ?? fallback ?? "";
}

function normalizeSourceAccess(source: PublicSourceSummary): ProfileSourceAccessState {
  const state = source.access_state.toLocaleLowerCase();
  if (["accessible", "available", "active"].includes(state)) return "accessible";
  if (["changed", "moved", "redirected"].includes(state)) return "changed";
  if (["restricted", "paywalled", "limited"].includes(state)) return "restricted";
  return "unavailable";
}

function maxVerifiedAt(panda: PandaDetail): string | null {
  const values = [
    ...panda.sources.map((source) => source.last_verified_at),
    ...panda.conclusions.map((conclusion) => conclusion.last_verified_at),
    ...panda.residencies.map((residency) => residency.last_verified_at).filter(
      (value): value is string => Boolean(value),
    ),
  ].filter((value): value is string => Boolean(value));
  return values.sort().at(-1) ?? null;
}

function relationViewModel(
  node: PandaLineageNode,
  locale: PublicLocale,
  relation: TrustedProfileRelationViewModel["relation"],
  status: TrustedProfileRelationViewModel["status"],
  sourceIds: string[],
  assertionId: string | null,
): TrustedProfileRelationViewModel {
  const name = displayName(node, locale);
  const profileAvailable = node.profile_available === true;
  return {
    assertionId,
    id: node.id,
    slug: node.slug,
    name: name.value,
    nameLanguage: name.language,
    relation,
    status,
    sourceIds,
    href: profileAvailable ? `/${locale}/atlas/${node.slug}` : null,
    profileAvailable,
  };
}

function buildFamily(
  record: PublicProfileRecord,
  locale: PublicLocale,
): TrustedProfilePageViewModel["family"] {
  const { panda, lineage, parentageAssertions } = record;
  const nodes = new Map(lineage.nodes.map((node) => [node.id, node]));
  const parents = parentageAssertions
    .filter((assertion) => assertion.child_id === panda.id)
    .flatMap((assertion) => {
      const node = nodes.get(assertion.parent_id);
      if (!node) return [];
      return [relationViewModel(
        node,
        locale,
        assertion.role,
        assertion.status,
        assertion.source_ids,
        assertion.id,
      )];
    })
    .sort((left, right) => (left.relation === "father" ? -1 : 1) - (right.relation === "father" ? -1 : 1));

  const children = parentageAssertions
    .filter((assertion) => assertion.parent_id === panda.id)
    .flatMap((assertion) => {
      const node = nodes.get(assertion.child_id);
      if (!node) return [];
      return [relationViewModel(
        node,
        locale,
        "child",
        assertion.status,
        assertion.source_ids,
        assertion.id,
      )];
    })
    .sort((left, right) => left.name.localeCompare(right.name, locale === "zh" ? "zh-CN" : "en"));

  const primaryIds = new Set([...parents, ...children].map((item) => item.id));
  const related = lineage.relationships
    .filter(
      (relationship) => relationship.subject_id === panda.id
        && ["sibling", "grandparent"].includes(relationship.kind)
        && !primaryIds.has(relationship.related_id),
    )
    .flatMap((relationship) => {
      const node = nodes.get(relationship.related_id);
      if (!node) return [];
      return [relationViewModel(
        node,
        locale,
        relationship.kind as "sibling" | "grandparent",
        "confirmed",
        [],
        null,
      )];
    });

  const allRelations = [...parents, ...children, ...related];
  const hasNonFinal = allRelations.some((item) => item.status !== "confirmed");
  return {
    state: allRelations.length === 0 ? "empty" : hasNonFinal ? "partial" : "complete",
    parents,
    children,
    related,
  };
}

function buildTimeline(
  record: PublicProfileRecord,
  locale: PublicLocale,
): TrustedProfilePageViewModel["timeline"] {
  const { panda, facilities } = record;
  const items: TrustedProfileTimelineItemViewModel[] = [
    ...panda.residencies.map((residency) => ({
      id: residency.id,
      date: residency.start_date,
      datePrecision: residency.start_precision,
      kind: "residency" as const,
      status: residency.status,
      fromLabel: null,
      toLabel: facilityName(
        residency.facility_id,
        residency.coarse_location,
        null,
        facilities,
        locale,
      ),
      endDate: residency.end_date,
      endPrecision: residency.end_precision,
      sourceIds: residency.source_ids,
      changesCurrentResidency: residency.end_date === null,
    })),
    ...panda.events.map((event) => ({
      id: event.id,
      date: event.event_date,
      datePrecision: event.event_date_precision,
      kind: "transfer" as const,
      status: event.event_status,
      fromLabel: facilityName(
        event.from_facility_id,
        event.from_coarse_location,
        null,
        facilities,
        locale,
      ) || null,
      toLabel: facilityName(
        event.to_facility_id,
        event.to_coarse_location,
        null,
        facilities,
        locale,
      ),
      endDate: null,
      endPrecision: null,
      sourceIds: event.source_ids,
      changesCurrentResidency: event.changes_current_residency,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date));

  return {
    state: items.length === 0
      ? "empty"
      : panda.record_tier === "complete_first_pass"
        ? "complete"
        : "partial",
    items,
  };
}

function httpsUrl(value: string | null | undefined): string | null {
  if (!value || !URL.canParse(value)) return null;
  return new URL(value).protocol === "https:" ? value : null;
}

function buildMedia(panda: PandaDetail, locale: PublicLocale): TrustedProfileMediaViewModel {
  const items = panda.media.map((item) => ({
    id: item.id,
    url: item.status === "available"
      ? httpsUrl(item.url) ?? httpsUrl(item.signed_url) ?? httpsUrl(item.storage_path)
      : null,
    sourceUrl: httpsUrl(item.source_url),
    rights: item.rights,
    credit: item.credit ?? item.photographer ?? null,
    alt: locale === "zh"
      ? item.alt_zh ?? item.alt_en ?? panda.name_zh
      : item.alt_en ?? item.alt_zh ?? panda.name_en ?? panda.name_zh,
    status: item.status,
    width: item.width,
    height: item.height,
    derivatives: item.status === "available"
      ? item.derivatives
        .filter((derivative) => Boolean(httpsUrl(derivative.url)))
        .map((derivative) => ({ url: derivative.url, width: derivative.width }))
        .sort((left, right) => left.width - right.width)
      : [],
  }));

  if (!panda.media_release) return { state: "unavailable", sourceIds: [], items };
  if (panda.media_release.license_state === "no_licensed_media") {
    return {
      state: "no_licensed_media",
      sourceIds: panda.media_release.source_ids,
      items,
    };
  }
  if (panda.media_release.license_state === "source_link_only") {
    return {
      state: "source_link_only",
      sourceIds: panda.media_release.source_ids,
      items,
    };
  }
  return {
    state: items.length ? "gallery" : "unavailable",
    sourceIds: panda.media_release.source_ids,
    items,
  };
}

export function buildTrustedProfilePageViewModel(
  record: PublicProfileRecord,
  locale: PublicLocale,
): TrustedProfilePageViewModel {
  const { panda, facilities, places } = record;
  if (!panda.identity) {
    throw new Error("A trusted profile view model requires a reviewed identity.");
  }

  const requestedContentLocale = publicLanguageTag(locale);
  const localizedContent = panda.localized_content.find(
    (item) => item.locale === requestedContentLocale,
  );
  const otherLocale = locale === "zh" ? "en" : "zh";
  const hasReviewedEnglishName = Boolean(panda.name_en);
  const displayNameValue = locale === "zh" || !hasReviewedEnglishName
    ? panda.name_zh
    : panda.name_en!;
  const currentPlaceLabel = facilityName(
    panda.current_place?.facility_id ?? null,
    panda.current_place?.coarse_location ?? null,
    panda.current_location,
    facilities,
    locale,
  );
  const timeline = buildTimeline(record, locale);
  const footprintStops = panda.residencies.map((residency) => ({
    id: residency.id,
    label: `${facilityName(
      residency.facility_id,
      residency.coarse_location,
      null,
      facilities,
      locale,
    )}${residency.status === "confirmed_country_level"
      ? locale === "zh" ? "（国家级记录）" : " (country-level record)"
      : ""}`,
    status: residency.status,
    residencyType: residency.residency_type,
    startDate: residency.start_date,
    startPrecision: residency.start_precision,
    endDate: residency.end_date,
    endPrecision: residency.end_precision,
    lastVerifiedAt: residency.last_verified_at,
    sourceIds: residency.source_ids,
    current: residency.end_date === null,
    entityHref: residency.facility_id
      ? (() => {
          const place = places.find((item) => item.facility_ids.includes(residency.facility_id!));
          return place ? `/${locale}/places/${place.canonical_slug}` : null;
        })()
      : null,
  }));
  const revisionSummary = panda.public_revision?.summaries.find(
    (item) => item.locale === requestedContentLocale,
  )?.summary ?? null;

  return {
    stableId: panda.identity.stable_id,
    canonicalSlug: panda.identity.canonical_slug,
    displayName: displayNameValue,
    displayNameLanguage: locale === "en" && !hasReviewedEnglishName ? "zh-CN" : requestedContentLocale,
    displayNameTranslation: locale === "en" && !hasReviewedEnglishName ? "missing" : "reviewed",
    alternateName: locale === "zh" ? panda.name_en : panda.name_zh,
    pinyin: panda.identity.names.find((item) => item.language === "pinyin")?.value ?? null,
    summary: localizedContent?.summary ?? null,
    recordTier: panda.record_tier,
    lastVerifiedAt: maxVerifiedAt(panda),
    identityReferences: [
      ...panda.identity.aliases.map((item) => ({
        value: item.value,
        kind: item.kind,
        sourceIds: item.source_ids,
      })),
      ...panda.identity.legacy_slugs.map((item) => ({
        value: item.value,
        kind: "legacy_slug",
        sourceIds: item.source_ids,
      })),
      ...panda.identity.external_identifiers.map((item) => ({
        value: `${item.system}: ${item.value}`,
        kind: "external_identifier",
        sourceIds: item.source_ids,
      })),
    ],
    facts: [
      fact(panda, "life_status", panda.status, "categorical"),
      fact(panda, "birth_date", panda.birth_date, panda.birth_date ? "day" : "unknown"),
      fact(panda, "sex", panda.gender, "categorical"),
      fact(
        panda,
        "current_coarse_location",
        currentPlaceLabel || panda.current_location,
        panda.current_place?.status === "confirmed_country_level" ? "country" : "unknown",
      ),
    ],
    currentPlace: {
      label: currentPlaceLabel,
      status: panda.current_place?.status ?? "unknown",
      lastVerifiedAt: panda.current_place?.last_verified_at ?? conclusionFor(
        panda,
        "current_coarse_location",
      )?.last_verified_at ?? null,
    },
    story: localizedContent
      ? { state: "reviewed", paragraphs: [localizedContent.summary] }
      : { state: "unavailable", paragraphs: [] },
    timeline,
    family: buildFamily(record, locale),
    footprint: {
      state: footprintStops.length === 0
        ? "empty"
        : footprintStops.some((stop) => stop.status === "provisional")
          ? "partial"
          : "complete",
      stops: footprintStops,
    },
    media: buildMedia(panda, locale),
    sources: panda.sources.map((source) => ({
      id: source.id,
      publisher: source.publisher,
      title: source.title,
      url: source.url,
      publishedAt: source.published_at,
      lastVerifiedAt: source.last_verified_at,
      language: source.language,
      accessState: normalizeSourceAccess(source),
      rawAccessState: source.access_state,
    })),
    revision: panda.public_revision
      ? {
          state: revisionSummary ? "reviewed" : "partial",
          dataVersion: panda.public_revision.data_version,
          publicSchemaVersion: panda.public_revision.public_schema_version,
          summary: revisionSummary,
        }
      : {
          state: "unavailable",
          dataVersion: null,
          publicSchemaVersion: null,
          summary: null,
        },
    atlasHref: `/${locale}/atlas`,
    alternateLanguageHref: `/${otherLocale}/atlas/${panda.identity.canonical_slug}`,
  };
}
