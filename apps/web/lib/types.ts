export type PandaStatus = "alive" | "deceased" | "unknown";
export type DistributionLayer = "wild" | "captive" | "protected_area" | "corridor";

export interface PandaListItem {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string | null;
  gender: "male" | "female" | "unknown";
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

export interface PandaLineageEdge {
  parent_id: string;
  child_id: string;
}

export interface PandaLineageResponse {
  focus_id: string;
  nodes: PandaLineageNode[];
  edges: PandaLineageEdge[];
  meta: {
    ancestor_depth: number;
    descendant_depth: number;
  };
}

export interface PaginatedPandasResponse {
  items: PandaListItem[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
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
  layer?: DistributionLayer;
  density?: number | null;
  cell_code?: string;
  snapshot_date?: string | null;
}

export interface HabitatFeatureProperties extends Record<string, unknown> {
  name?: string;
  province?: string | null;
  level?: string | null;
}

export interface DistributionSnapshot {
  snapshot_date: string;
  version: string;
  notes: string | null;
}

export interface DistributionSnapshotList {
  items: DistributionSnapshot[];
}

export interface OverviewStats {
  total_pandas: number;
  active_habitats: number;
  latest_snapshot_date: string;
  wild_distribution_cells: number;
  featured_pandas: number;
}

export type ImportJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface ImportSourceOption {
  name: string;
  label: string;
  source_path: string;
}

export interface ImportSourceList {
  items: ImportSourceOption[];
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
