export const PROFILE_PREFERENCES_STORAGE_KEY = "panda-atlas:profile-preferences";
export const LEGACY_SAVED_PROFILES_STORAGE_KEY = "panda-atlas:saved-profiles";
export const PROFILE_PREFERENCES_CHANGE_EVENT = "panda-atlas:profile-preferences-change";

const STORAGE_VERSION = 1;
export const MAX_RECENT_PROFILES = 12;

export interface StoredProfilePreferenceEntry {
  id: string;
  at: string;
}

export interface ProfilePreferencesSnapshot {
  saved: StoredProfilePreferenceEntry[];
  recent: StoredProfilePreferenceEntry[];
}

export interface ProfilePreferenceReference {
  id: string;
  aliases: readonly string[];
}

interface StoredProfilePreferences {
  version: 1;
  saved: [];
  recent: StoredProfilePreferenceEntry[];
}

const EMPTY_SNAPSHOT: ProfilePreferencesSnapshot = Object.freeze({ saved: [], recent: [] });

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeReference(
  value: string,
  references: readonly ProfilePreferenceReference[],
): string | null {
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

function writeRecent(recent: StoredProfilePreferenceEntry[]): void {
  if (!canUseStorage()) return;
  const payload: StoredProfilePreferences = {
    version: STORAGE_VERSION,
    saved: [],
    recent: recent.slice(0, MAX_RECENT_PROFILES),
  };
  try {
    window.localStorage.setItem(PROFILE_PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
    window.localStorage.removeItem(LEGACY_SAVED_PROFILES_STORAGE_KEY);
    window.dispatchEvent(new Event(PROFILE_PREFERENCES_CHANGE_EVENT));
  } catch {
    // Browser privacy settings or quota failures leave the public archive usable.
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
    ) as Partial<StoredProfilePreferences> | null;
    if (parsed?.version === STORAGE_VERSION) {
      recent = normalizeRecent(parsed.recent, references);
    }
  } catch {
    recent = [];
  }
  writeRecent(recent);
  return { saved: [], recent };
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

/** @deprecated Saved Panda was removed; use authenticated Follow. */
export function toggleSavedProfile(
  _id: string,
  references: readonly ProfilePreferenceReference[] = [],
  _now = new Date(),
): false {
  void _now;
  readProfilePreferences(references);
  return false;
}

/** @deprecated Saved Panda was removed; use authenticated Follow. */
export function removeSavedProfile(
  _id: string,
  references: readonly ProfilePreferenceReference[] = [],
): void {
  readProfilePreferences(references);
}

/** @deprecated Saved Panda was removed; use authenticated Follow. */
export function clearSavedProfiles(
  references: readonly ProfilePreferenceReference[] = [],
): void {
  readProfilePreferences(references);
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

export function clearRecentProfiles(
  references: readonly ProfilePreferenceReference[] = [],
): void {
  void references;
  writeRecent([]);
}
