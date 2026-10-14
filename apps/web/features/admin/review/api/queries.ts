import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  claimReviewCase,
  decideReviewCase,
  getReviewCaseSurface,
  listReviewCases,
  openReviewCase,
  verifyReviewSource,
} from "./service";
import type {
  OpenReviewCaseInput,
  QueueQuery,
  ReviewDecisionInput,
  ReviewState,
  VerifyReviewSourceInput,
} from "./types";

export const reviewKeys = {
  all: ["admin", "review"] as const,
  queues: ["admin", "review", "queue"] as const,
  queue: (query: QueueQuery<ReviewState>) => [...reviewKeys.queues, query] as const,
  surfaces: ["admin", "review", "surface"] as const,
  surface: (reviewCaseId: string) => [...reviewKeys.surfaces, reviewCaseId] as const,
};

export function reviewQueueQueryOptions(query: QueueQuery<ReviewState>) {
  return queryOptions({ queryKey: reviewKeys.queue(query), queryFn: () => listReviewCases(query) });
}

export function reviewSurfaceQueryOptions(reviewCaseId: string) {
  return queryOptions({ queryKey: reviewKeys.surface(reviewCaseId), queryFn: () => getReviewCaseSurface(reviewCaseId) });
}

export const reviewMutationOptions = {
  open: () => mutationOptions({ mutationFn: (input: OpenReviewCaseInput) => openReviewCase(input) }),
  claim: () => mutationOptions({ mutationFn: (reviewCaseId: string) => claimReviewCase(reviewCaseId) }),
  verifySource: () => mutationOptions({
    mutationFn: ({ reviewCaseId, input }: { reviewCaseId: string; input: VerifyReviewSourceInput }) =>
      verifyReviewSource(reviewCaseId, input),
  }),
  decide: () => mutationOptions({
    mutationFn: ({ reviewCaseId, input }: { reviewCaseId: string; input: ReviewDecisionInput }) =>
      decideReviewCase(reviewCaseId, input),
  }),
};
