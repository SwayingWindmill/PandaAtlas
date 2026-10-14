export type Locale = "zh" | "en";

export type SubmissionType = "correction" | "sourced_information";

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

export interface SubmittedSource {
  source_kind: "url" | "publication" | "document" | "other";
  title: string;
  locator: string;
  publisher?: string | null;
  published_on?: string | null;
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

export interface SubmissionPage {
  items: SubmissionSummary[];
  next_cursor: string | null;
}

export interface V2ContributionRecord {
  submissionId: string;
  submissionType: SubmissionType;
  targetPandaId: string;
  publicVersionSeen: string;
  revisionNumber: number;
  status: string;
  statusExplanation?: string;
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
