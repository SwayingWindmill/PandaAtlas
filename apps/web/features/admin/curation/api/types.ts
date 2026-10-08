import type { components } from "@zhipanda/api-client";

export type CurationChangeSet = components["schemas"]["CurationChangeSetDto"];
export type CurationChangeSetSummary = components["schemas"]["CurationChangeSetSummaryDto"];
export type CurationChangeSetPage = components["schemas"]["CurationChangeSetPageDto"];
export type CurationState = "draft" | "validated" | "approved" | "applied" | "rejected";
export type CurationListParams = { limit: number; offset: number; state?: CurationState };
