export type Locale = "zh" | "en";

export type SubmissionType = "correction" | "sourced_information";

// The statuses the API writes: submitted, then one review outcome.
export type ContributorStatus = "submitted" | "accepted" | "not_accepted" | "duplicate" | "out_of_scope";

export interface V2ContributionRecord {
  submissionId: string;
  submissionType: SubmissionType;
  targetPandaId: string;
  publicVersionSeen: string;
  revisionNumber: number;
  status: ContributorStatus;
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
