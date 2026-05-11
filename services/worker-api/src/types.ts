export type PandaGender = "male" | "female" | "unknown";
export type PandaStatus = "alive" | "deceased" | "unknown";
export type DistributionLayer = "wild" | "captive" | "protected_area" | "corridor";
export type ImportJobStatus = "queued" | "running" | "succeeded" | "failed";

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

export interface GeoJsonFeatureCollection<TProperties extends Record<string, unknown> = Record<string, unknown>> {
  type: "FeatureCollection";
  features: Array<GeoJsonFeature<TProperties>>;
}

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

export interface ImportJobSummary {
  rows_total: number;
  rows_success: number;
  rows_failed: number;
  source_name: string;
  source_path: string;
  mode: string;
  failure_reason: string | null;
}

export interface ImportJob {
  id: string;
  source_name: string;
  source_uri: string | null;
  status: ImportJobStatus;
  summary: ImportJobSummary;
  error_log: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
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
