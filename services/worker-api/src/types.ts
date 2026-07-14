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

export interface PandaDetail extends PandaListItem {
  intro: string | null;
  birthplace: string | null;
  tags: string[];
  father_id: string | null;
  mother_id: string | null;
  habitats: Array<{ id: string; name: string; province: string | null }>;
  media: Array<{
    id: string;
    storage_bucket: string;
    storage_path: string;
    title: string | null;
    photographer: string | null;
    signed_url: string | null;
  }>;
  identity: PandaIdentityProfile | null;
  conclusions: PublicFactConclusion[];
  sources: PublicSourceSummary[];
}

export interface PandaLineageNode extends PandaListItem {
  intro: string | null;
  tags: string[];
  father_id: string | null;
  mother_id: string | null;
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
}
