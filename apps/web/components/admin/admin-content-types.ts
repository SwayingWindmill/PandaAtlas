export type AdminPublicationState = "draft" | "published";
export type AdminDataQuality = "verified" | "likely" | "uncertain";

export interface AdminPandaListItem {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string | null;
  gender: string;
  birth_date: string | null;
  current_location: string | null;
  publication_state: AdminPublicationState;
  workflow_state: string;
  completeness: number;
  data_quality: AdminDataQuality;
  has_cover: boolean;
  source_count: number;
  updated_at: string;
  last_editor: string | null;
  working_change_set_id: string | null;
}

export interface AdminPandaListRead {
  items: AdminPandaListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminPandaNameRead {
  id: string;
  value: string;
  language_tag: string;
  name_kind: string;
  is_primary: boolean;
  publication_status: string;
  source_ids: string[];
}

export interface AdminPandaParentRead {
  assertion_id: string;
  role: "father" | "mother";
  status: string;
  parent_id: string;
  parent_slug: string;
  parent_name_zh: string;
  parent_name_en: string | null;
  parent_birth_date: string | null;
  source_ids: string[];
}

export interface AdminPandaResidencyRead {
  id: string;
  residency_type: string;
  start_date: string;
  start_precision: string;
  end_date: string | null;
  end_precision: string | null;
  status: string;
  publication_status: string;
  facility_id: string | null;
  facility_name: string | null;
  coarse_location: string | null;
  source_ids: string[];
}

export interface AdminPandaEventRead {
  id: string;
  event_type: string;
  event_status: string;
  event_date: string;
  event_date_precision: string;
  publication_status: string;
  source_ids: string[];
}

export interface AdminPandaMediaRead {
  id: string;
  title: string | null;
  photographer: string | null;
  copyright_text: string | null;
  license: string | null;
  taken_at: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  url: string | null;
  source_url: string | null;
  credit: string | null;
  alt_zh: string | null;
  alt_en: string | null;
  source_ids: string[];
  is_cover: boolean;
  display_order: number;
}

export interface AdminEvidenceSourceRead {
  id: string;
  publisher: string;
  title: string;
  url: string;
  published_at: string | null;
  last_verified_at: string;
  access_state: string;
  publication_status: string;
  evidence_tier: string | null;
}

export interface AdminPandaWorkflowRead {
  change_set_id: string | null;
  status: string;
  governance_version: number | null;
  validation_state: string | null;
  validation_reason: string | null;
  base_archive_version: string;
  can_validate: boolean;
  can_publish: boolean;
}

export interface AdminPandaDetailRead {
  panda: AdminPandaListItem;
  status: string;
  death_date: string | null;
  birthplace: string | null;
  intro: string | null;
  tags: string[];
  is_featured: boolean;
  names: AdminPandaNameRead[];
  parents: AdminPandaParentRead[];
  residencies: AdminPandaResidencyRead[];
  events: AdminPandaEventRead[];
  media: AdminPandaMediaRead[];
  sources: AdminEvidenceSourceRead[];
  workflow: AdminPandaWorkflowRead;
  quality_issues: string[];
}

export interface AdminDashboardIssue {
  code: string;
  label: string;
  count: number;
  href: string;
}

export interface AdminRecentActivityRead {
  actor: string;
  action: string;
  object_type: string;
  object_id: string;
  occurred_at: string;
}

export interface AdminContentDashboardRead {
  panda_total: number;
  panda_published: number;
  panda_draft: number;
  panda_incomplete: number;
  pending_media: number;
  recent_sources: number;
  issues: AdminDashboardIssue[];
  recent_activity: AdminRecentActivityRead[];
}

export interface AdminPandaValidationRead {
  change_set_id: string;
  outcome: "ready" | "validation_failed";
  governance_version: number;
  base_archive_version: string;
  issues: Array<{
    category: string;
    entity_type: string;
    entity_id: string;
    detail: string;
  }>;
}

export type AdminCenterDomain =
  | "locations"
  | "relationships"
  | "events"
  | "images"
  | "sources"
  | "users";

export interface AdminCenterItemRead {
  id: string;
  domain: AdminCenterDomain;
  entity_type: string;
  title: string;
  subtitle: string | null;
  state: string;
  issue_codes: string[];
  panda_id: string | null;
  panda_name: string | null;
  href: string | null;
  updated_at: string | null;
}

export interface AdminCenterRead {
  domain: AdminCenterDomain;
  items: AdminCenterItemRead[];
  total: number;
  page: number;
  page_size: number;
  issue_count: number;
}
