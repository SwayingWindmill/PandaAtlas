import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryOptions } from "@tanstack/react-query";

import type { Game, GameEntry } from "@/features/book/book";
import { type Collection, sortCollections } from "@/features/collections/collections";
import { type Visit, sortVisits } from "@/features/visits/visits";
import { queryClient } from "@/lib/query-client";

export const GUEST_STORAGE_KEYS = {
  favorites: "zhipanda:guest:favorites",
  seen: "zhipanda:guest:seen",
  followedVenues: "zhipanda:guest:followed-venues",
  visits: "zhipanda:guest:visits",
  collections: "zhipanda:guest:collections",
  games: "zhipanda:guest:games",
} as const;

export const guestFavoritesQueryKey = ["guest", "favorites"] as const;
export const guestSeenQueryKey = ["guest", "seen"] as const;
export const guestFollowedVenuesQueryKey = ["guest", "followed-venues"] as const;
export const guestVisitsQueryKey = ["guest", "visits"] as const;
export const guestCollectionsQueryKey = ["guest", "collections"] as const;
export const guestGamesQueryKey = ["guest", "games"] as const;

export interface GuestSeenEntry {
  seenOn: string;
  firstSeenAt: string;
  placeId?: string | null;
}

export type GuestSeenMap = Record<string, GuestSeenEntry>;

export interface GuestData {
  followedPandas: string[];
  seenPandas: GuestSeenMap;
  followedVenues: string[];
  visits: Visit[];
  collections: Collection[];
  games: GameEntry[];
}

export interface GuestPruneInput {
  followedPandas?: ReadonlySet<string>;
  seenPandaIds?: ReadonlySet<string>;
  followedVenues?: ReadonlySet<string>;
  visitIds?: ReadonlySet<string>;
  /** Collection ID -> synced panda IDs; collections with all items synced are removed, partial keep remaining items. */
  syncedCollections?: ReadonlyMap<string, ReadonlySet<string>>;
}

const keyQueues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, work: () => Promise<T>): Promise<T> {
  const prev = keyQueues.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(work);
  const tracked = next.catch(() => undefined).finally(() => {
    if (keyQueues.get(key) === tracked) keyQueues.delete(key);
  });
  keyQueues.set(key, tracked);
  return next;
}

function localId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJson<T>(key: string, parse: (raw: unknown) => T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return parse(null);
    return parse(JSON.parse(raw));
  } catch {
    return parse(null);
  }
}

async function writeJson<T>(
  key: string,
  queryKey: readonly string[],
  value: T,
): Promise<T> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  queryClient.setQueryData(queryKey, value);
  return value;
}

function invalidateGuestDerived(): void {
  void queryClient.invalidateQueries({ queryKey: ["guest", "book"] });
  void queryClient.invalidateQueries({ queryKey: ["guest", "milestones"] });
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function parseSeenMap(raw: unknown): GuestSeenMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: GuestSeenMap = {};
  for (const [pandaId, value] of Object.entries(raw)) {
    if (!pandaId || !value || typeof value !== "object") continue;
    const candidate = value as Partial<GuestSeenEntry>;
    if (typeof candidate.seenOn !== "string" || typeof candidate.firstSeenAt !== "string") continue;
    out[pandaId] = {
      seenOn: candidate.seenOn,
      firstSeenAt: candidate.firstSeenAt,
      placeId: typeof candidate.placeId === "string" ? candidate.placeId : null,
    };
  }
  return out;
}

function parseVisits(raw: unknown): Visit[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.filter((item): item is Visit => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<Visit>;
    return (
      typeof candidate.checkinId === "string" &&
      typeof candidate.placeId === "string" &&
      typeof candidate.visitedOn === "string" &&
      typeof candidate.createdAt === "string"
    );
  });
  return sortVisits(items);
}

function parseCollections(raw: unknown): Collection[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.flatMap((item): Collection[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<Collection>;
    if (
      typeof candidate.collectionId !== "string" ||
      typeof candidate.name !== "string" ||
      !Array.isArray(candidate.pandaIds) ||
      typeof candidate.createdAt !== "string" ||
      typeof candidate.updatedAt !== "string"
    ) {
      return [];
    }
    return [
      {
        collectionId: candidate.collectionId,
        name: candidate.name,
        pandaIds: parseStringArray(candidate.pandaIds),
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      },
    ];
  });
  return sortCollections(items);
}

function parseGames(raw: unknown): GameEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is GameEntry => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<GameEntry>;
    return (
      typeof candidate.pandaId === "string" &&
      (candidate.firstGame === "daily_panda" || candidate.firstGame === "guess_panda") &&
      typeof candidate.firstMetAt === "string" &&
      typeof candidate.timesMet === "number" &&
      Number.isFinite(candidate.timesMet)
    );
  });
}

export async function loadGuestFavorites(): Promise<string[]> {
  return readJson(GUEST_STORAGE_KEYS.favorites, parseStringArray);
}

export function guestFavoritesQueryOptions() {
  return queryOptions({
    queryKey: guestFavoritesQueryKey,
    queryFn: loadGuestFavorites,
    staleTime: 0,
    networkMode: "always",
  });
}

export function setGuestFollowing(pandaId: string, following: boolean): Promise<string[]> {
  return enqueue(GUEST_STORAGE_KEYS.favorites, async () => {
    const current = await loadGuestFavorites();
    const next = following ? [...new Set([...current, pandaId])] : current.filter((id) => id !== pandaId);
    return writeJson(GUEST_STORAGE_KEYS.favorites, guestFavoritesQueryKey, next);
  });
}

export async function loadGuestSeen(): Promise<GuestSeenMap> {
  return readJson(GUEST_STORAGE_KEYS.seen, parseSeenMap);
}

export function guestSeenQueryOptions() {
  return queryOptions({
    queryKey: guestSeenQueryKey,
    queryFn: loadGuestSeen,
    staleTime: 0,
    networkMode: "always",
  });
}

export function setGuestSeen(
  pandaId: string,
  seenOn: string | null,
  placeId?: string | null,
): Promise<GuestSeenMap> {
  return enqueue(GUEST_STORAGE_KEYS.seen, async () => {
    const current = await loadGuestSeen();
    const next: GuestSeenMap = { ...current };
    if (seenOn === null) {
      delete next[pandaId];
    } else {
      const existing = current[pandaId];
      next[pandaId] = {
        seenOn,
        firstSeenAt: existing?.firstSeenAt ?? new Date().toISOString(),
        placeId: placeId !== undefined ? placeId : (existing?.placeId ?? null),
      };
    }
    const saved = await writeJson(GUEST_STORAGE_KEYS.seen, guestSeenQueryKey, next);
    invalidateGuestDerived();
    return saved;
  });
}

export async function loadGuestFollowedVenues(): Promise<string[]> {
  return readJson(GUEST_STORAGE_KEYS.followedVenues, parseStringArray);
}

export function guestFollowedVenuesQueryOptions() {
  return queryOptions({
    queryKey: guestFollowedVenuesQueryKey,
    queryFn: loadGuestFollowedVenues,
    staleTime: 0,
    networkMode: "always",
  });
}

export function setGuestFollowingVenue(slug: string, following: boolean): Promise<string[]> {
  return enqueue(GUEST_STORAGE_KEYS.followedVenues, async () => {
    const current = await loadGuestFollowedVenues();
    const next = following ? [...new Set([...current, slug])] : current.filter((item) => item !== slug);
    return writeJson(GUEST_STORAGE_KEYS.followedVenues, guestFollowedVenuesQueryKey, next);
  });
}

export async function loadGuestVisits(): Promise<Visit[]> {
  return readJson(GUEST_STORAGE_KEYS.visits, parseVisits);
}

export function guestVisitsQueryOptions() {
  return queryOptions({
    queryKey: guestVisitsQueryKey,
    queryFn: loadGuestVisits,
    staleTime: 0,
    networkMode: "always",
  });
}

export function recordGuestVisit(placeId: string, visitedOn: string): Promise<Visit> {
  return enqueue(GUEST_STORAGE_KEYS.visits, async () => {
    const current = await loadGuestVisits();
    const visit: Visit = {
      checkinId: localId("local-visit"),
      placeId,
      visitedOn,
      note: null,
      createdAt: new Date().toISOString(),
    };
    const next = sortVisits([visit, ...current]);
    await writeJson(GUEST_STORAGE_KEYS.visits, guestVisitsQueryKey, next);
    invalidateGuestDerived();
    return visit;
  });
}

export function removeGuestVisit(checkinId: string): Promise<Visit[]> {
  return enqueue(GUEST_STORAGE_KEYS.visits, async () => {
    const current = await loadGuestVisits();
    const next = current.filter((item) => item.checkinId !== checkinId);
    const saved = await writeJson(GUEST_STORAGE_KEYS.visits, guestVisitsQueryKey, next);
    invalidateGuestDerived();
    return saved;
  });
}

export async function loadGuestCollections(): Promise<Collection[]> {
  return readJson(GUEST_STORAGE_KEYS.collections, parseCollections);
}

export function guestCollectionsQueryOptions() {
  return queryOptions({
    queryKey: guestCollectionsQueryKey,
    queryFn: loadGuestCollections,
    staleTime: 0,
    networkMode: "always",
  });
}

export function createGuestCollection(name: string): Promise<Collection> {
  return enqueue(GUEST_STORAGE_KEYS.collections, async () => {
    const current = await loadGuestCollections();
    const now = new Date().toISOString();
    const created: Collection = {
      collectionId: localId("local-col"),
      name,
      pandaIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await writeJson(GUEST_STORAGE_KEYS.collections, guestCollectionsQueryKey, sortCollections([created, ...current]));
    return created;
  });
}

export function renameGuestCollection(collectionId: string, name: string): Promise<Collection> {
  return enqueue(GUEST_STORAGE_KEYS.collections, async () => {
    const current = await loadGuestCollections();
    const target = current.find((item) => item.collectionId === collectionId);
    if (!target) throw new Error("Guest collection not found");
    const updated: Collection = { ...target, name, updatedAt: new Date().toISOString() };
    const next = sortCollections(current.map((item) => (item.collectionId === collectionId ? updated : item)));
    await writeJson(GUEST_STORAGE_KEYS.collections, guestCollectionsQueryKey, next);
    return updated;
  });
}

export function deleteGuestCollection(collectionId: string): Promise<void> {
  return enqueue(GUEST_STORAGE_KEYS.collections, async () => {
    const current = await loadGuestCollections();
    const next = current.filter((item) => item.collectionId !== collectionId);
    await writeJson(GUEST_STORAGE_KEYS.collections, guestCollectionsQueryKey, next);
  });
}

export function setInGuestCollection(collectionId: string, pandaId: string, inside: boolean): Promise<Collection> {
  return enqueue(GUEST_STORAGE_KEYS.collections, async () => {
    const current = await loadGuestCollections();
    const target = current.find((item) => item.collectionId === collectionId);
    if (!target) throw new Error("Guest collection not found");
    const pandaIds = inside
      ? [...new Set([...target.pandaIds, pandaId])]
      : target.pandaIds.filter((id) => id !== pandaId);
    const updated: Collection = { ...target, pandaIds, updatedAt: new Date().toISOString() };
    const next = sortCollections(current.map((item) => (item.collectionId === collectionId ? updated : item)));
    await writeJson(GUEST_STORAGE_KEYS.collections, guestCollectionsQueryKey, next);
    return updated;
  });
}

export async function loadGuestGames(): Promise<GameEntry[]> {
  return readJson(GUEST_STORAGE_KEYS.games, parseGames);
}

export function guestGamesQueryOptions() {
  return queryOptions({
    queryKey: guestGamesQueryKey,
    queryFn: loadGuestGames,
    staleTime: 0,
    networkMode: "always",
  });
}

export function recordGuestGame(pandaId: string, game: Game, metAt: string): Promise<GameEntry[]> {
  return enqueue(GUEST_STORAGE_KEYS.games, async () => {
    const current = await loadGuestGames();
    const existing = current.find((item) => item.pandaId === pandaId);
    let next: GameEntry[];
    if (existing) {
      if (game === "daily_panda" && existing.firstGame === "daily_panda" && existing.firstMetAt.slice(0, 10) === metAt.slice(0, 10)) {
        return current;
      }
      const firstMetAt = metAt < existing.firstMetAt ? metAt : existing.firstMetAt;
      const updated: GameEntry = { ...existing, firstMetAt, timesMet: existing.timesMet + 1 };
      next = current.map((item) => (item.pandaId === pandaId ? updated : item));
    } else {
      next = [...current, { pandaId, firstGame: game, firstMetAt: metAt, timesMet: 1 }];
    }
    const saved = await writeJson(GUEST_STORAGE_KEYS.games, guestGamesQueryKey, next);
    invalidateGuestDerived();
    return saved;
  });
}

export async function readAllGuestData(): Promise<GuestData> {
  const [followedPandas, seenPandas, followedVenues, visits, collections, games] = await Promise.all([
    loadGuestFavorites(),
    loadGuestSeen(),
    loadGuestFollowedVenues(),
    loadGuestVisits(),
    loadGuestCollections(),
    loadGuestGames(),
  ]);
  return { followedPandas, seenPandas, followedVenues, visits, collections, games };
}

export async function pruneSyncedGuestData(input: GuestPruneInput): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (input.followedPandas && input.followedPandas.size > 0) {
    const synced = input.followedPandas;
    tasks.push(
      enqueue(GUEST_STORAGE_KEYS.favorites, async () => {
        const current = await loadGuestFavorites();
        return writeJson(
          GUEST_STORAGE_KEYS.favorites,
          guestFavoritesQueryKey,
          current.filter((id) => !synced.has(id)),
        );
      }),
    );
  }

  if (input.seenPandaIds && input.seenPandaIds.size > 0) {
    const synced = input.seenPandaIds;
    tasks.push(
      enqueue(GUEST_STORAGE_KEYS.seen, async () => {
        const current = await loadGuestSeen();
        const next: GuestSeenMap = { ...current };
        for (const id of synced) delete next[id];
        return writeJson(GUEST_STORAGE_KEYS.seen, guestSeenQueryKey, next);
      }),
    );
  }

  if (input.followedVenues && input.followedVenues.size > 0) {
    const synced = input.followedVenues;
    tasks.push(
      enqueue(GUEST_STORAGE_KEYS.followedVenues, async () => {
        const current = await loadGuestFollowedVenues();
        return writeJson(
          GUEST_STORAGE_KEYS.followedVenues,
          guestFollowedVenuesQueryKey,
          current.filter((slug) => !synced.has(slug)),
        );
      }),
    );
  }

  if (input.visitIds && input.visitIds.size > 0) {
    const synced = input.visitIds;
    tasks.push(
      enqueue(GUEST_STORAGE_KEYS.visits, async () => {
        const current = await loadGuestVisits();
        return writeJson(
          GUEST_STORAGE_KEYS.visits,
          guestVisitsQueryKey,
          current.filter((item) => !synced.has(item.checkinId)),
        );
      }),
    );
  }

  if (input.syncedCollections && input.syncedCollections.size > 0) {
    const synced = input.syncedCollections;
    tasks.push(
      enqueue(GUEST_STORAGE_KEYS.collections, async () => {
        const current = await loadGuestCollections();
        const next = current.flatMap((col): Collection[] => {
          const syncedPandas = synced.get(col.collectionId);
          if (!syncedPandas) return [col];
          const remaining = col.pandaIds.filter((id) => !syncedPandas.has(id));
          if (remaining.length === 0) return [];
          return [{ ...col, pandaIds: remaining }];
        });
        return writeJson(GUEST_STORAGE_KEYS.collections, guestCollectionsQueryKey, sortCollections(next));
      }),
    );
  }

  await Promise.all(tasks);
  if (tasks.length > 0) invalidateGuestDerived();
}
