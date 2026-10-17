import type { components } from "@zhipanda/api-client";

export type Locale = "zh" | "en";

export type V2ContributionRecord = components["schemas"]["ContributionRecordDto"];
export type V2ContributionList = components["schemas"]["ContributionListDto"];
export type ContributorStatus = V2ContributionRecord["status"];
export type V2ContributionInput = components["schemas"]["SubmitContributionDto"];
export type SubmissionType = V2ContributionInput["submissionType"];
