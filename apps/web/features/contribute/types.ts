import type { components } from "@zhipanda/api-client";

export type Locale = "zh" | "en";

export type SubmissionType = "correction" | "sourced_information";

export type V2ContributionRecord = components["schemas"]["ContributionRecordDto"];
export type V2ContributionList = components["schemas"]["ContributionListDto"];
export type ContributorStatus = V2ContributionRecord["status"];

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
