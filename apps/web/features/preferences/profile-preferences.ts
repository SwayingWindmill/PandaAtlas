export const PROFILE_PREFERENCES_STORAGE_KEY = "panda-atlas:profile-preferences";
export const LEGACY_SAVED_PREFERENCE_STORAGE_KEY = "panda-atlas:profile-preferences.saved";
export const LEGACY_SAVED_PROFILES_STORAGE_KEY = "panda-atlas:saved-profiles";
export const PROFILE_PREFERENCES_CHANGE_EVENT = "panda-atlas:profile-preferences-change";

const STORAGE_VERSION = 2;
export const MAX_RECENT_PROFILES = 12;

export interface StoredProfilePreferenceEntry {
  id: string;
  at: string;
}

export interface ProfilePreferencesSnapshot {
  recent: StoredProfilePreferenceEntry[];
}

export interface ProfilePreferenceReference {
  id: string;
  aliases: readonly string[];
}

interface StoredProfilePreferences {
  version: 2;
  recent: StoredProfilePreferenceEntry[];
}

const EMPTY_SNAPSHOT: ProfilePreferencesSnapshot = Object.freeze({ recent: [] });

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeReference(value: string, references: readonly ProfilePreferenceReference[]): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = references.find((reference) => (
    reference.id === normalized || reference.aliases.includes(normalized)
  ));
  return match?.id ?? normalized;
}

function normalizeRecent(
  value: unknown,
  references: readonly ProfilePreferenceReference[],
): StoredProfilePreferenceEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: StoredProfilePreferenceEntry[] = [];
  for (const item of value) {
    const rawId = item && typeof item === "object" && "id" in item
      ? (item as { id?: unknown }).id
      : null;
    if (typeof rawId !== "string") continue;
    const id = normalizeReference(rawId, references);
    if (!id || seen.has(id)) continue;
    const rawAt = item && typeof item === "object" && "at" in item
      ? (item as { at?: unknown }).at
      : null;
    const at = normalizeTimestamp(rawAt) ?? new Date(0).toISOString();
    seen.add(id);
    entries.push({ id, at });
    if (entries.length >= MAX_RECENT_PROFILES) break;
  }
  return entries;
}

function cleanupLegacySavedData(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(LEGACY_SAVED_PREFERENCE_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_SAVED_PROFILES_STORAGE_KEY);
}

function writeRecent(recent: StoredProfilePreferenceEntry[]): void {
  if (!canUseStorage()) return;
  const payload: StoredProfilePreferences = {
    version: STORAGE_VERSION,
    recent: recent.slice(0, MAX_RECENT_PROFILES),
  };
  try {
    window.localStorage.setItem(PROFILE_PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
    cleanupLegacySavedData();
    window.dispatchEvent(new Event(PROFILE_PREFERENCES_CHANGE_EVENT));
  } catch {
    // Browser privacy settings or quota failures leave public Panda discovery usable.
  }
}

export function readProfilePreferences(
  references: readonly ProfilePreferenceReference[] = [],
): ProfilePreferencesSnapshot {
  if (!canUseStorage()) return EMPTY_SNAPSHOT;
  let recent: StoredProfilePreferenceEntry[] = [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY) ?? "null",
    ) as { version?: unknown; recent?: unknown } | null;
    if (parsed?.version === STORAGE_VERSION || parsed?.version === 1) {
      recent = normalizeRecent(parsed.recent, references);
    }
  } catch {
    recent = [];
  }
  writeRecent(recent);
  return { recent };
}

export function subscribeToProfilePreferences(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onChange);
  window.addEventListener(PROFILE_PREFERENCES_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PROFILE_PREFERENCES_CHANGE_EVENT, onChange);
  };
}

export function recordRecentProfile(
  id: string,
  references: readonly ProfilePreferenceReference[] = [],
  now = new Date(),
): void {
  const snapshot = readProfilePreferences(references);
  const recent = [
    { id, at: now.toISOString() },
    ...snapshot.recent.filter((entry) => entry.id !== id),
  ].slice(0, MAX_RECENT_PROFILES);
  writeRecent(recent);
}

export function removeRecentProfile(
  id: string,
  references: readonly ProfilePreferenceReference[] = [],
): void {
  const snapshot = readProfilePreferences(references);
  writeRecent(snapshot.recent.filter((entry) => entry.id !== id));
}

export function clearRecentProfiles(): void {
  writeRecent([]);
}
