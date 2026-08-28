export type Locale = "zh" | "en";

export type SubmissionType = "correction" | "sourced_information";

export type ClaimKind =
  | "identity_name"
  | "vital_event"
  | "health"
  | "relationship"
  | "residency_transfer"
  | "institution"
  | "source"
  | "other";

export type ContributorStatus =
  | "draft"
  | "submitted"
  | "action_required"
  | "duplicate"
  | "out_of_scope"
  | "not_accepted"
  | "accepted"
  | "incorporation_in_progress"
  | "incorporated_full"
  | "incorporated_partial"
  | "withdrawn"
  | "expired"
  | "target_merged"
  | "target_unpublished";

export interface StructuredAssertion {
  assertion_key: string;
  kind: ClaimKind;
  field_path: string;
  proposed_value: unknown;
  explanation: string;
  source_locators: string[];
  attachment_ids: string[];
}

export interface SubmittedSource {
  source_kind: "url" | "publication" | "document" | "other";
  title: string;
  locator: string;
  publisher?: string | null;
  published_on?: string | null;
}

export interface AttachmentView {
  attachment_id: string;
  submission_id: string;
  bound_revision_number: number | null;
  original_filename: string;
  media_type: string;
  byte_size: number;
  state: "quarantined" | "clean" | "infected" | "scan_failed" | "deleted";
  upload_completed_at: string | null;
  scan_attempts: number;
  last_scan_code: string | null;
  last_scanned_at: string | null;
  metadata_stripped: boolean;
  created_at: string;
}

export interface SubmittedSourceView extends SubmittedSource {
  source_id: string;
  revision_number: number;
  created_at: string;
}

export interface SubmissionRevision {
  revision_number: number;
  content: {
    schema_version?: number;
    assertions?: StructuredAssertion[];
    additional_context?: string | null;
  };
  content_sha256: string;
  public_version_seen: string;
  submitted_at: string;
  sources: SubmittedSourceView[];
}

export interface StatusEvent {
  status_event_id: string;
  status: ContributorStatus;
  active_revision_number: number | null;
  user_visible_reason: string | null;
  action_required_fields: string[];
  target_redirect_id: string | null;
  occurred_at: string;
}

export interface AssertionResult {
  assertion_key: string;
  revision_number: number;
  disposition:
    | "pending"
    | "selected"
    | "not_selected"
    | "incorporated"
    | "not_incorporated"
    | "superseded";
  explanation: string | null;
  public_reference_id: string | null;
  created_at: string;
}

export interface SubmissionSummary {
  submission_id: string;
  submission_type: SubmissionType;
  target_type: "panda";
  target_id: string;
  public_version_seen: string;
  state: "draft" | "submitted" | "withdrawn" | "expired" | "closed";
  contributor_status: ContributorStatus;
  version: number;
  latest_revision_number: number;
  user_visible_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionView extends SubmissionSummary {
  draft_content: {
    schema_version?: number;
    assertions?: StructuredAssertion[];
    sources?: SubmittedSource[];
    additional_context?: string | null;
  };
  expires_at: string;
  submitted_at: string | null;
  withdrawn_at: string | null;
  closed_at: string | null;
  revisions: SubmissionRevision[];
  attachments: AttachmentView[];
  status_history: StatusEvent[];
  assertion_results: AssertionResult[];
}

export interface SubmissionPage {
  items: SubmissionSummary[];
  next_cursor: string | null;
}

export interface CommandResult {
  submission: SubmissionView;
  inline_confirmation: boolean;
  notification_created: boolean;
}

export interface AttachmentReservation {
  attachment: AttachmentView;
  upload_reference: { reference: string; expires_at: string };
}

export interface ContributorAnalytics {
  total: number;
  open_count: number;
  action_required_count: number;
  by_status: Partial<Record<ContributorStatus, number>>;
  latest_activity_at: string | null;
}

export interface V2ContributionRecord {
  submissionId: string;
  submissionType: SubmissionType;
  targetPandaId: string;
  publicVersionSeen: string;
  revisionNumber: number;
  status: string;
  submittedAt: string;
}

export interface V2ContributionList {
  items: V2ContributionRecord[];
}

export interface V2ContributionInput {
  submissionType: SubmissionType;
  targetPandaId: string;
  publicVersionSeen: string;
  assertions: Array<{
    assertionKey: string;
    fieldKey: string;
    value: unknown;
    certainty: "confirmed" | "provisional";
    lastVerifiedOn: string;
    sourceKeys: string[];
  }>;
  sources: Array<{
    sourceKey: string;
    sourceKind: "url" | "publication" | "document" | "other";
    title: string;
    locator: string;
    publisher?: string;
    publishedOn?: string;
  }>;
}
