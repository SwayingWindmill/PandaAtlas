import type {
  V2ContributionInput,
  V2ContributionList,
  V2ContributionRecord,
} from "@/features/fan/api/types";
import type { PublicLocale } from "@/lib/locales";

export type Locale = PublicLocale;
export type { V2ContributionInput, V2ContributionList, V2ContributionRecord };
export type ContributorStatus = V2ContributionRecord["status"];
export type SubmissionType = V2ContributionInput["submissionType"];
