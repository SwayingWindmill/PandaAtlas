import type { V2ContributionInput, V2ContributionList, V2ContributionRecord } from "@/features/contribute/types";
import { ApiRequestError, requestJson } from "@/lib/api/request";

import type {
  Checkin,
  FanCollection,
  FanSession,
  Favorite,
  GameAttempt,
  GuessAnswer,
  GuessQuestion,
  NotificationInbox,
  NotificationMessage,
  NotificationPreference,
  PassportEntry,
  SeenPanda,
} from "./types";

const encode = encodeURIComponent;

export function getFanSession(): Promise<FanSession> {
  return requestJson("/api/identity/session");
}

export async function listFavorites(): Promise<Favorite[]> {
  return (await requestJson<{ items: Favorite[] }>("/api/engagement/favorites")).items;
}

export function setFavorite(pandaId: string, favorite: boolean): Promise<unknown> {
  return requestJson(`/api/engagement/favorites/${encode(pandaId)}`, { method: favorite ? "POST" : "DELETE" });
}

export async function getSeenPanda(pandaId: string): Promise<SeenPanda | null> {
  try {
    return await requestJson<SeenPanda>(`/api/engagement/seen-pandas/${encode(pandaId)}`);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export async function listSeenPandas(): Promise<SeenPanda[]> {
  return (await requestJson<{ items: SeenPanda[] }>("/api/engagement/seen-pandas")).items;
}

export function saveSeenPanda(
  pandaId: string,
  record: { seenOn: string | null; placeId: string | null; note: string | null },
): Promise<SeenPanda> {
  return requestJson(`/api/engagement/seen-pandas/${encode(pandaId)}`, { method: "PUT", body: JSON.stringify(record) });
}

export function removeSeenPanda(pandaId: string): Promise<unknown> {
  return requestJson(`/api/engagement/seen-pandas/${encode(pandaId)}`, { method: "DELETE" });
}

export async function listCheckins(): Promise<Checkin[]> {
  return (await requestJson<{ items: Checkin[] }>("/api/engagement/checkins")).items;
}

export function createCheckin(record: { placeId: string; visitedOn: string; note: string | null }): Promise<Checkin> {
  return requestJson("/api/engagement/checkins", { method: "POST", body: JSON.stringify(record) });
}

export function removeCheckin(checkinId: string): Promise<unknown> {
  return requestJson(`/api/engagement/checkins/${encode(checkinId)}`, { method: "DELETE" });
}

export async function listCollections(): Promise<FanCollection[]> {
  return (await requestJson<{ items: FanCollection[] }>("/api/engagement/collections")).items;
}

export function createCollection(name: string): Promise<FanCollection> {
  return requestJson("/api/engagement/collections", { method: "POST", body: JSON.stringify({ name }) });
}

export function renameCollection(collectionId: string, name: string): Promise<FanCollection> {
  return requestJson(`/api/engagement/collections/${encode(collectionId)}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export function deleteCollection(collectionId: string): Promise<unknown> {
  return requestJson(`/api/engagement/collections/${encode(collectionId)}`, { method: "DELETE" });
}

export function setCollectionMembership(collectionId: string, pandaId: string, member: boolean): Promise<FanCollection> {
  return requestJson(`/api/engagement/collections/${encode(collectionId)}/pandas/${encode(pandaId)}`, {
    method: member ? "POST" : "DELETE",
  });
}

export async function listGameAttempts(): Promise<GameAttempt[]> {
  return (await requestJson<{ items: GameAttempt[] }>("/api/engagement/game-attempts")).items;
}

export function saveGameAttempt(attempt: { questionId: string; selectedPandaId: string }): Promise<unknown> {
  return requestJson("/api/engagement/game-attempts", { method: "POST", body: JSON.stringify(attempt) });
}

export async function listPassportEntries(): Promise<PassportEntry[]> {
  return (await requestJson<{ entries: PassportEntry[] }>("/api/engagement/passport")).entries;
}

export function getInbox(): Promise<NotificationInbox> {
  return requestJson("/api/notification/inbox");
}

export function markNotificationRead(messageId: string): Promise<NotificationMessage> {
  return requestJson(`/api/notification/inbox/${encode(messageId)}/read`, { method: "PATCH", body: "{}" });
}

export function markAllNotificationsRead(): Promise<unknown> {
  return requestJson("/api/notification/inbox/read-all", { method: "PATCH", body: "{}" });
}

export function listNotificationPreferences(): Promise<NotificationPreference[]> {
  return requestJson("/api/notification/preferences");
}

export function updateNotificationPreference(
  preference: { category: string; channel: "email"; enabled: boolean },
): Promise<NotificationPreference> {
  return requestJson("/api/notification/preferences", { method: "PUT", body: JSON.stringify(preference) });
}

export function listSubmissions(): Promise<V2ContributionList> {
  return requestJson("/api/community-intake/submissions");
}

export function getSubmission(submissionId: string): Promise<V2ContributionRecord> {
  return requestJson(`/api/community-intake/submissions/${encode(submissionId)}`);
}

export function submitContribution(body: V2ContributionInput): Promise<V2ContributionRecord> {
  return requestJson("/api/community-intake/submissions", { method: "POST", body: JSON.stringify(body) });
}

// The guess game is public; only saving an attempt needs the session.
export function getGuessQuestion(locale: "zh" | "en"): Promise<GuessQuestion> {
  return requestJson(`/api/games/guess/question?locale=${locale}`);
}

export function answerGuess(answer: { questionId: string; selectedPandaId: string; locale: "zh" | "en" }): Promise<GuessAnswer> {
  return requestJson("/api/games/guess/answer", { method: "POST", body: JSON.stringify(answer) });
}
