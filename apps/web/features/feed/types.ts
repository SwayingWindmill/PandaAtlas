export type ActivityRetractionState = "active" | "corrected" | "retracted";
export type FeedAttribution = "followed" | "history" | "pinned";

export interface ActivityTarget {
  target_type: "panda" | "institution";
  target_id: string;
}

export interface LocalizedActivitySnapshot {
  locale: string;
  title: string;
  summary: string;
  fallback_from_locale?: string | null;
}

export interface ActivityMediaReference {
  asset_id: string;
  variant: string;
  alt_text: string;
}

export interface ActivityProvenance {
  release_id?: string | null;
  data_version?: string | null;
  public_schema_version?: string | null;
  projection_code_version?: string | null;
  public_reference_ids: string[];
}

export interface ActivityPin {
  starts_at: string;
  ends_at: string;
  reason: string;
}

export interface ActivityItem {
  activity_id: string;
  source_type: string;
  source_id: string;
  source_version: number;
  source_event_id: string;
  activity_type:
    | "panda.birth"
    | "panda.death"
    | "panda.named"
    | "panda.relocated"
    | "panda.birthday"
    | "panda.health_major"
    | "archive.profile_corrected"
    | "editorial.announcement";
  targets: ActivityTarget[];
  importance: "ordinary" | "important" | "critical" | null;
  importance_override_reason?: string | null;
  visibility: "public" | "unlisted";
  sitewide: boolean;
  notification_eligible: boolean;
  occurred_at: string;
  occurred_precision: "exact" | "day" | "month" | "year" | "range" | "unknown";
  occurred_end_at?: string | null;
  published_at: string;
  updated_at: string;
  localization_key: string;
  localization_version: number;
  localized_snapshots: LocalizedActivitySnapshot[];
  media?: ActivityMediaReference | null;
  provenance: ActivityProvenance;
  pin?: ActivityPin | null;
  retraction_state: ActivityRetractionState;
  retracted_at?: string | null;
  retraction_reason?: string | null;
  correction_activity_id?: string | null;
  is_backfill: boolean;
}

export interface ActivityPageData {
  items: ActivityItem[];
  next_cursor: string | null;
}

export interface FeedItemData {
  activity: ActivityItem;
  attribution: FeedAttribution;
  followed_panda_ids: string[];
  is_pinned: boolean;
  is_new: boolean;
  deleted_target_ids: string[];
}

export interface FeedPageData {
  items: FeedItemData[];
  next_cursor: string | null;
  last_viewed_at: string | null;
  projection_stale: boolean;
  projection_lag_seconds: number;
}

export type FeedLoadResult =
  | { state: "ready"; page: FeedPageData }
  | { state: "unauthenticated" }
  | { state: "blocked" }
  | { state: "disabled" }
  | { state: "unavailable"; source: "api" };

export type PublicActivityLoadResult =
  | { state: "ready"; page: ActivityPageData }
  | { state: "disabled" }
  | { state: "unavailable"; source: "api" };
