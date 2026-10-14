import type { components } from "@zhipanda/api-client";

export type ReviewCasePage = components["schemas"]["ReviewCasePageDto"];
export type ReviewCaseQueueItem = components["schemas"]["ReviewCaseQueueItemDto"];
export type ReviewCaseSurface = components["schemas"]["ReviewCaseSurfaceDto"];
export type ReviewCase = components["schemas"]["ReviewCaseDto"];
export type OpenReviewCaseInput = components["schemas"]["OpenReviewCaseDto"];
export type VerifyReviewSourceInput = components["schemas"]["VerifyReviewSourceDto"];
export type ReviewDecisionInput = components["schemas"]["RecordReviewDecisionDto"];

export type ReviewState = ReviewCaseQueueItem["state"];

export const REVIEW_STATES = ["new", "assigned", "closed"] as const satisfies readonly ReviewState[];

export interface QueueQuery<TState extends string> {
  state?: TState;
  limit: number;
  offset: number;
}
