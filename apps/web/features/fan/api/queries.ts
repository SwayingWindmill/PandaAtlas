import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import {
  answerGuess,
  createCheckin,
  createCollection,
  deleteCollection,
  getFanSession,
  getDailyPanda,
  getGuessQuestion,
  getInbox,
  getSeenPanda,
  getSubmission,
  guessDailyPanda,
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
import type { Favorite, NotificationInbox, NotificationPreference } from "./types";

// Private account data; each write below names the reads it changes.
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

function invalidate(client: QueryClient, ...queryKeys: ReadonlyArray<readonly unknown[]>) {
  return Promise.all(queryKeys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

export const fanMutationOptions = {
  setFavorite: () => mutationOptions({
    mutationFn: ({ pandaId, favorite }: { pandaId: string; favorite: boolean }) => setFavorite(pandaId, favorite),
    // The control shows the new state at once; the passport, which also counts contributions, refetches.
    onSuccess: (saved, { pandaId, favorite }, _result, { client }) => {
      client.setQueryData<Favorite[]>(fanKeys.favorites, (current = []) => {
        const others = current.filter((entry) => entry.pandaId !== pandaId);
        return favorite && saved.favoritedAt ? [...others, { pandaId, favoritedAt: saved.favoritedAt }] : others;
      });
      return invalidate(client, fanKeys.passport);
    },
  }),
  saveSeenPanda: () => mutationOptions({
    mutationFn: ({ pandaId, record }: { pandaId: string; record: Parameters<typeof saveSeenPanda>[1] }) =>
      saveSeenPanda(pandaId, record),
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.seenPandas),
  }),
  removeSeenPanda: () => mutationOptions({
    mutationFn: removeSeenPanda,
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.seenPandas),
  }),
  createCheckin: () => mutationOptions({
    mutationFn: createCheckin,
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.checkins),
  }),
  removeCheckin: () => mutationOptions({
    mutationFn: removeCheckin,
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.checkins),
  }),
  createCollection: () => mutationOptions({
    mutationFn: createCollection,
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.collections),
  }),
  renameCollection: () => mutationOptions({
    mutationFn: ({ collectionId, name }: { collectionId: string; name: string }) => renameCollection(collectionId, name),
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.collections),
  }),
  deleteCollection: () => mutationOptions({
    mutationFn: deleteCollection,
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.collections),
  }),
  setCollectionMembership: () => mutationOptions({
    mutationFn: ({ collectionId, pandaId, member }: { collectionId: string; pandaId: string; member: boolean }) =>
      setCollectionMembership(collectionId, pandaId, member),
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.collections),
  }),
  saveGameAttempt: () => mutationOptions({
    mutationFn: saveGameAttempt,
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.gameAttempts),
  }),
  submitContribution: () => mutationOptions({
    mutationFn: submitContribution,
    onSuccess: (_data, _variables, _result, { client }) => invalidate(client, fanKeys.submissions, fanKeys.passport),
  }),
  // The API returns the changed message or preference; the cache takes that representation.
  markNotificationRead: () => mutationOptions({
    mutationFn: markNotificationRead,
    onSuccess: (updated, messageId, _result, { client }) => {
      client.setQueryData<NotificationInbox>(fanKeys.inbox, (current) => {
        if (!current) return current;
        const wasUnread = current.items.some((entry) => entry.messageId === messageId && entry.readAt === null);
        return {
          unreadCount: Math.max(0, current.unreadCount - (wasUnread ? 1 : 0)),
          items: current.items.map((entry) => (entry.messageId === messageId ? updated : entry)),
        };
      });
    },
  }),
  markAllNotificationsRead: () => mutationOptions({
    mutationFn: markAllNotificationsRead,
    onSuccess: (_data, _variables, _result, { client }) => {
      const now = new Date().toISOString();
      client.setQueryData<NotificationInbox>(fanKeys.inbox, (current) =>
        current ? { unreadCount: 0, items: current.items.map((entry) => ({ ...entry, readAt: entry.readAt ?? now })) } : current,
      );
    },
  }),
  updateNotificationPreference: () => mutationOptions({
    mutationFn: updateNotificationPreference,
    onSuccess: (updated, _variables, _result, { client }) => {
      client.setQueryData<NotificationPreference[]>(fanKeys.preferences, (current) => [
        ...(current ?? []).filter((preference) => !(preference.category === updated.category && preference.channel === updated.channel)),
        updated,
      ]);
    },
  }),
  getGuessQuestion: () => mutationOptions({ mutationFn: getGuessQuestion }),
  answerGuess: () => mutationOptions({ mutationFn: answerGuess }),
  getDailyPanda: () => mutationOptions({ mutationFn: getDailyPanda }),
  guessDailyPanda: () => mutationOptions({ mutationFn: guessDailyPanda }),
};
