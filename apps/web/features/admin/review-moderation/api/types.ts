import type { components } from "@zhipanda/api-client";

export type ReviewCasePage = components["schemas"]["ReviewCasePageDto"];
export type ReviewCaseQueueItem = components["schemas"]["ReviewCaseQueueItemDto"];
export type ReviewCaseSurface = components["schemas"]["ReviewCaseSurfaceDto"];
export type ReviewCase = components["schemas"]["ReviewCaseDto"];
export type OpenReviewCaseInput = components["schemas"]["OpenReviewCaseDto"];
export type VerifyReviewSourceInput = components["schemas"]["VerifyReviewSourceDto"];
export type ReviewDecisionInput = components["schemas"]["RecordReviewDecisionDto"];
export type ReviewRecommendationInput = components["schemas"]["RecommendReviewDto"];
export type ReviewRecommendation = components["schemas"]["ReviewRecommendationDto"];

export type ModerationAppealPage = components["schemas"]["ModerationAppealPageDto"];
export type ModerationAppealQueueItem = components["schemas"]["ModerationAppealQueueItemDto"];
export type ModerationAccount = components["schemas"]["ModerationAccountDto"];
export type ModerationSanction = components["schemas"]["ModerationSanctionDto"];
export type ApplySanctionInput = components["schemas"]["ApplySanctionDto"];
export type RestoreSanctionInput = components["schemas"]["RestoreSanctionDto"];
export type DecideAppealInput = components["schemas"]["DecideAppealDto"];

export type ReviewState =
  | "new"
  | "triage"
  | "assigned"
  | "waiting"
  | "decision_ready"
  | "incorporation_recommended"
  | "closed";

export type AppealState = "open" | "under_review" | "closed";

export interface QueueQuery<TState extends string> {
  state?: TState;
  limit: number;
  offset: number;
}
