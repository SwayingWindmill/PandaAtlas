import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  answerGuess,
  createCheckin,
  createCollection,
  deleteCollection,
  getFanSession,
  getGuessQuestion,
  getInbox,
  getSeenPanda,
  getSubmission,
  listCheckins,
  listCollections,
  listFavorites,
  listGameAttempts,
  listNotificationPreferences,
  listPassportEntries,
  listSeenPandas,
  listSubmissions,
  markAllNotificationsRead,
  markNotificationRead,
  removeCheckin,
  removeSeenPanda,
  renameCollection,
  saveGameAttempt,
  saveSeenPanda,
  setCollectionMembership,
  setFavorite,
  submitContribution,
  updateNotificationPreference,
} from "./service";

// Private account data: the keys the mutations invalidate.
export const fanKeys = {
  session: ["fan", "session"] as const,
  favorites: ["fan", "favorites"] as const,
  seenPandas: ["fan", "seen-pandas"] as const,
  seenPanda: (pandaId: string) => ["fan", "seen-pandas", pandaId] as const,
  checkins: ["fan", "checkins"] as const,
  collections: ["fan", "collections"] as const,
  gameAttempts: ["fan", "game-attempts"] as const,
  passport: ["fan", "passport"] as const,
  inbox: ["fan", "inbox"] as const,
  preferences: ["fan", "preferences"] as const,
  submissions: ["fan", "submissions"] as const,
  submission: (submissionId: string) => ["fan", "submissions", submissionId] as const,
};

export const fanSessionQueryOptions = queryOptions({ queryKey: fanKeys.session, queryFn: getFanSession, retry: false });
export const favoritesQueryOptions = queryOptions({ queryKey: fanKeys.favorites, queryFn: listFavorites });
export const seenPandasQueryOptions = queryOptions({ queryKey: fanKeys.seenPandas, queryFn: listSeenPandas });
export const seenPandaQueryOptions = (pandaId: string) =>
  queryOptions({ queryKey: fanKeys.seenPanda(pandaId), queryFn: () => getSeenPanda(pandaId) });
export const checkinsQueryOptions = queryOptions({ queryKey: fanKeys.checkins, queryFn: listCheckins });
export const collectionsQueryOptions = queryOptions({ queryKey: fanKeys.collections, queryFn: listCollections });
export const gameAttemptsQueryOptions = queryOptions({ queryKey: fanKeys.gameAttempts, queryFn: listGameAttempts });
export const passportQueryOptions = queryOptions({ queryKey: fanKeys.passport, queryFn: listPassportEntries });
export const inboxQueryOptions = queryOptions({ queryKey: fanKeys.inbox, queryFn: getInbox });
export const preferencesQueryOptions = queryOptions({ queryKey: fanKeys.preferences, queryFn: listNotificationPreferences });
export const submissionsQueryOptions = queryOptions({ queryKey: fanKeys.submissions, queryFn: listSubmissions });
export const submissionQueryOptions = (submissionId: string) =>
  queryOptions({ queryKey: fanKeys.submission(submissionId), queryFn: () => getSubmission(submissionId) });

export const fanMutationOptions = {
  setFavorite: () => mutationOptions({
    mutationFn: ({ pandaId, favorite }: { pandaId: string; favorite: boolean }) => setFavorite(pandaId, favorite),
  }),
  saveSeenPanda: () => mutationOptions({
    mutationFn: ({ pandaId, record }: { pandaId: string; record: Parameters<typeof saveSeenPanda>[1] }) =>
      saveSeenPanda(pandaId, record),
  }),
  removeSeenPanda: () => mutationOptions({ mutationFn: (pandaId: string) => removeSeenPanda(pandaId) }),
  createCheckin: () => mutationOptions({ mutationFn: (record: Parameters<typeof createCheckin>[0]) => createCheckin(record) }),
  removeCheckin: () => mutationOptions({ mutationFn: (checkinId: string) => removeCheckin(checkinId) }),
  createCollection: () => mutationOptions({ mutationFn: (name: string) => createCollection(name) }),
  renameCollection: () => mutationOptions({
    mutationFn: ({ collectionId, name }: { collectionId: string; name: string }) => renameCollection(collectionId, name),
  }),
  deleteCollection: () => mutationOptions({ mutationFn: (collectionId: string) => deleteCollection(collectionId) }),
  setCollectionMembership: () => mutationOptions({
    mutationFn: ({ collectionId, pandaId, member }: { collectionId: string; pandaId: string; member: boolean }) =>
      setCollectionMembership(collectionId, pandaId, member),
  }),
  saveGameAttempt: () => mutationOptions({ mutationFn: (attempt: Parameters<typeof saveGameAttempt>[0]) => saveGameAttempt(attempt) }),
  markNotificationRead: () => mutationOptions({ mutationFn: (messageId: string) => markNotificationRead(messageId) }),
  markAllNotificationsRead: () => mutationOptions({ mutationFn: () => markAllNotificationsRead() }),
  updateNotificationPreference: () => mutationOptions({
    mutationFn: (preference: Parameters<typeof updateNotificationPreference>[0]) => updateNotificationPreference(preference),
  }),
  submitContribution: () => mutationOptions({
    mutationFn: (body: Parameters<typeof submitContribution>[0]) => submitContribution(body),
  }),
  getGuessQuestion: () => mutationOptions({ mutationFn: (locale: "zh" | "en") => getGuessQuestion(locale) }),
  answerGuess: () => mutationOptions({ mutationFn: (answer: Parameters<typeof answerGuess>[0]) => answerGuess(answer) }),
};
