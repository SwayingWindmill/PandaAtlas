import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  applyModerationSanction,
  claimReviewCase,
  decideModerationAppeal,
  decideReviewCase,
  getModerationAccount,
  getReviewCaseSurface,
  listModerationAppeals,
  listReviewCases,
  openReviewCase,
  recommendReviewCase,
  restoreModerationSanction,
  verifyReviewSource,
} from "./service";
import type {
  AppealState,
  ApplySanctionInput,
  DecideAppealInput,
  OpenReviewCaseInput,
  QueueQuery,
  RestoreSanctionInput,
  ReviewDecisionInput,
  ReviewRecommendationInput,
  ReviewState,
  VerifyReviewSourceInput,
} from "./types";

export const reviewKeys = {
  all: ["admin", "review"] as const,
  queue: (query: QueueQuery<ReviewState>) => [...reviewKeys.all, "queue", query] as const,
  surface: (reviewCaseId: string) => [...reviewKeys.all, "surface", reviewCaseId] as const,
};

export const moderationKeys = {
  all: ["admin", "moderation"] as const,
  appeals: (query: QueueQuery<AppealState>) => [...moderationKeys.all, "appeals", query] as const,
  account: (accountId: string) => [...moderationKeys.all, "account", accountId] as const,
};

export function reviewQueueQueryOptions(query: QueueQuery<ReviewState>) {
  return queryOptions({ queryKey: reviewKeys.queue(query), queryFn: () => listReviewCases(query) });
}

export function reviewSurfaceQueryOptions(reviewCaseId: string) {
  return queryOptions({ queryKey: reviewKeys.surface(reviewCaseId), queryFn: () => getReviewCaseSurface(reviewCaseId) });
}

export function moderationAppealsQueryOptions(query: QueueQuery<AppealState>) {
  return queryOptions({ queryKey: moderationKeys.appeals(query), queryFn: () => listModerationAppeals(query) });
}

export function moderationAccountQueryOptions(accountId: string) {
  return queryOptions({ queryKey: moderationKeys.account(accountId), queryFn: () => getModerationAccount(accountId) });
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
  recommend: () => mutationOptions({
    mutationFn: ({ reviewCaseId, input }: { reviewCaseId: string; input: ReviewRecommendationInput }) =>
      recommendReviewCase(reviewCaseId, input),
  }),
};

export const moderationMutationOptions = {
  applySanction: () => mutationOptions({
    mutationFn: ({ accountId, input }: { accountId: string; input: ApplySanctionInput }) =>
      applyModerationSanction(accountId, input),
  }),
  restoreSanction: () => mutationOptions({
    mutationFn: ({ sanctionId, input }: { sanctionId: string; input: RestoreSanctionInput }) =>
      restoreModerationSanction(sanctionId, input),
  }),
  decideAppeal: () => mutationOptions({
    mutationFn: ({ appealCaseId, input }: { appealCaseId: string; input: DecideAppealInput }) =>
      decideModerationAppeal(appealCaseId, input),
  }),
};
