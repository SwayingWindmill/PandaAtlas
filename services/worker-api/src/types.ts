export type PandaGender = "male" | "female" | "unknown";
export type PandaStatus = "alive" | "deceased" | "unknown";
export type DistributionLayer = "wild" | "captive" | "protected_area" | "corridor";

export interface PandaListItem {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string | null;
  gender: PandaGender;
  status: PandaStatus;
  birth_date: string | null;
  current_location: string | null;
  cover_image_url: string | null;
  search_terms: string[];
}

export interface IdentityNameRecord {
  value: string;
  language: string;
  kind: string;
  primary: boolean;
  source_ids: string[];
}

export interface LegacySlugRecord {
  value: string;
  source_ids: string[];
}

export interface ExternalIdentifierRecord {
  system: string;
  value: string;
  source_ids: string[];
}

export interface PandaIdentityProfile {
  stable_id: string;
  canonical_slug: string;
  names: IdentityNameRecord[];
  aliases: IdentityNameRecord[];
  legacy_slugs: LegacySlugRecord[];
  external_identifiers: ExternalIdentifierRecord[];
}

export type PublicConclusionStatus = "confirmed" | "provisional" | "disputed" | "superseded";

export interface PublicFactConclusion {
  field: string;
  value: unknown | null;
  status: PublicConclusionStatus;
  last_verified_at: string;
  assertion_ids: string[];
  source_ids: string[];
  candidate_values: unknown[];
  superseded_values: unknown[];
}

export interface PublicSourceSummary {
  id: string;
  publisher: string;
  title: string;
  url: string;
  published_at: string | null;
  last_verified_at: string;
  language: string;
  access_state: string;
}

export interface LocalizedPublicContent {
  locale: string;
  summary: string;
}

export interface PublicMediaRelease {
  license_state: "licensed" | "no_licensed_media" | "source_link_only";
  display_mode: "gallery" | "designed_empty_state" | "link_to_source";
  source_ids: string[];
}

export interface PublicMediaDerivative {
  kind: string;
  url: string;
  sha256: string;
  mime_type: string;
  width: number;
  height: number;
  bytes: number;
}

export interface PublicPandaMediaAsset {
  id: string;
  panda_id: string | null;
  url: string | null;
  source_url: string | null;
  rights: string | null;
  credit: string | null;
  alt_zh: string | null;
  alt_en: string | null;
  status: "available" | "withdrawn" | "unavailable";
  sha256: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  derivatives: PublicMediaDerivative[];
  source_ids: string[];
  storage_bucket?: string | null;
  storage_path?: string | null;
  title?: string | null;
  photographer?: string | null;
  signed_url?: string | null;
}

export interface PublicRevisionSummary {
  data_version: string;
  public_schema_version: string;
  summaries: LocalizedPublicContent[];
}

export interface PandaDetail extends PandaListItem {
  intro: string | null;
  birthplace: string | null;
  tags: string[];
  father_id: string | null;
  mother_id: string | null;
  habitats: Array<{ id: string; name: string; province: string | null }>;
  media: PublicPandaMediaAsset[];
  identity: PandaIdentityProfile | null;
  conclusions: PublicFactConclusion[];
  sources: PublicSourceSummary[];
  current_place: CurrentPlaceSummary | null;
  residencies: PandaResidencySummary[];
  events: PandaDomainEventSummary[];
  record_tier: string | null;
  localized_content: LocalizedPublicContent[];
  media_release: PublicMediaRelease | null;
  public_revision: PublicRevisionSummary | null;
}

export interface CurrentPlaceSummary {
  facility_id: string | null;
  coarse_location: string | null;
  status: "confirmed" | "confirmed_country_level" | "provisional";
}

export interface PandaResidencySummary extends CurrentPlaceSummary {
  id: string;
  residency_type: "primary" | "temporary" | "transit" | "quarantine";
  start_date: string;
  start_precision: "day" | "month" | "year";
  end_date: string | null;
  end_precision: "day" | "month" | "year" | null;
  source_ids: string[];
}

export interface PandaDomainEventSummary {
  id: string;
  event_type: "transfer";
  event_status: "announced" | "completed" | "cancelled" | "disputed";
  event_date: string;
  event_date_precision: "day" | "month" | "year";
  participants: string[];
  from_facility_id: string | null;
  from_coarse_location: string | null;
  to_facility_id: string | null;
  to_coarse_location: string | null;
  source_ids: string[];
  changes_current_residency: boolean;
}

export interface PandaLineageNode extends PandaListItem {
  intro: string | null;
  tags: string[];
  father_id: string | null;
  mother_id: string | null;
}

export interface ParentageRow {
  child_id: string;
  parent_id: string;
  parent_role: "father" | "mother";
}

export interface PandaLineageRelationship {
  subject_id: string;
  related_id: string;
  kind: "parent" | "child" | "sibling" | "grandparent";
  path: string[];
}

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface GeoJsonFeature<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: "Feature";
  id?: string | number;
  geometry: GeoJsonGeometry;
  properties: TProperties;
}

export interface FeatureCollectionMeta {
  truncated: boolean;
  limit: number | null;
  requested_zoom: number | null;
}

export interface GeoJsonFeatureCollection<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: "FeatureCollection";
  features: Array<GeoJsonFeature<TProperties>>;
  meta?: FeatureCollectionMeta;
}

export type CompleteGeoJsonFeatureCollection<
  TProperties extends Record<string, unknown> = Record<string, unknown>
> = GeoJsonFeatureCollection<TProperties> & {
  meta: FeatureCollectionMeta;
};

export interface DistributionFeatureProperties extends Record<string, unknown> {
  layer: DistributionLayer;
  cell_code: string;
  density: number | null;
  snapshot_date: string | null;
}

export interface HabitatFeatureProperties extends Record<string, unknown> {
  name: string;
  province: string | null;
  level: string | null;
}

export interface DistributionSnapshot {
  snapshot_date: string;
  version: string;
  notes: string | null;
}

export interface OverviewStats {
  total_pandas: number;
  active_habitats: number;
  latest_snapshot_date: string;
  wild_distribution_cells: number;
  featured_pandas: number;
}

export interface PublicReleaseMetadata {
  dataset_release_version: string;
  public_schema_version: string;
  database_migration_version: string;
  publication_batch_id: string;
  projection_code_version: string;
  released_at: string;
  licenses: Record<string, string>;
}

export interface PublicPandaRelease {
  release: PublicReleaseMetadata;
  records: Array<Record<string, unknown>>;
}

export interface PandaRow {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string | null;
  gender: PandaGender;
  status: PandaStatus;
  birth_date: string | null;
  birthplace: string | null;
  current_location: string | null;
  intro: string | null;
  tags_json: string | null;
  father_id: string | null;
  mother_id: string | null;
  is_featured: number;
  cover_image_url: string | null;
  search_terms_json: string | null;
  record_tier: string | null;
  localized_content_json: string | null;
  media_release_json: string | null;
  public_revision_json: string | null;
}
