export const PROFILE_PREFERENCES_STORAGE_KEY = "panda-atlas:profile-preferences";
export const LEGACY_SAVED_PROFILES_STORAGE_KEY = "panda-atlas:saved-profiles";
export const PROFILE_PREFERENCES_CHANGE_EVENT = "panda-atlas:profile-preferences-change";

const STORAGE_VERSION = 1;
const MAX_SAVED_PROFILES = 100;
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
  saved: StoredProfilePreferenceEntry[];
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

function normalizeReference(value: string, references: readonly ProfilePreferenceReference[]): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const match = references.find((reference) => (
    reference.id === normalized || reference.aliases.includes(normalized)
  ));
  return match?.id ?? normalized;
}

function normalizeEntries(
  value: unknown,
  references: readonly ProfilePreferenceReference[],
  limit: number,
): StoredProfilePreferenceEntry[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const entries: StoredProfilePreferenceEntry[] = [];
  for (const item of value) {
    const rawId = typeof item === "string"
      ? item
      : item && typeof item === "object" && "id" in item
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
    if (entries.length >= limit) break;
  }
  return entries;
}

function parseStoredPreferences(
  raw: string | null,
  references: readonly ProfilePreferenceReference[],
): ProfilePreferencesSnapshot {
  if (!raw) return EMPTY_SNAPSHOT;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredProfilePreferences> | null;
    if (!parsed || parsed.version !== STORAGE_VERSION) return EMPTY_SNAPSHOT;
    return {
      saved: normalizeEntries(parsed.saved, references, MAX_SAVED_PROFILES),
      recent: normalizeEntries(parsed.recent, references, MAX_RECENT_PROFILES),
    };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

function readLegacySaved(
  references: readonly ProfilePreferenceReference[],
): StoredProfilePreferenceEntry[] {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_SAVED_PROFILES_STORAGE_KEY) ?? "[]");
    return normalizeEntries(parsed, references, MAX_SAVED_PROFILES);
  } catch {
    return [];
  }
}

function writeSnapshot(snapshot: ProfilePreferencesSnapshot): void {
  if (!canUseStorage()) return;
  const payload: StoredProfilePreferences = {
    version: STORAGE_VERSION,
    saved: snapshot.saved.slice(0, MAX_SAVED_PROFILES),
    recent: snapshot.recent.slice(0, MAX_RECENT_PROFILES),
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
  const stored = parseStoredPreferences(
    window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY),
    references,
  );
  const legacySaved = readLegacySaved(references);
  if (!legacySaved.length) return stored;

  const existing = new Set(stored.saved.map((entry) => entry.id));
  const migrated = [
    ...stored.saved,
    ...legacySaved.filter((entry) => !existing.has(entry.id)),
  ].slice(0, MAX_SAVED_PROFILES);
  const snapshot = { ...stored, saved: migrated };
  writeSnapshot(snapshot);
  return snapshot;
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

export function toggleSavedProfile(
  id: string,
  references: readonly ProfilePreferenceReference[] = [],
  now = new Date(),
): boolean {
  const snapshot = readProfilePreferences(references);
  const saved = snapshot.saved.filter((entry) => entry.id !== id);
  const willSave = saved.length === snapshot.saved.length;
  if (willSave) saved.unshift({ id, at: now.toISOString() });
  writeSnapshot({ ...snapshot, saved: saved.slice(0, MAX_SAVED_PROFILES) });
  return willSave;
}

export function removeSavedProfile(
  id: string,
  references: readonly ProfilePreferenceReference[] = [],
): void {
  const snapshot = readProfilePreferences(references);
  writeSnapshot({ ...snapshot, saved: snapshot.saved.filter((entry) => entry.id !== id) });
}

export function clearSavedProfiles(
  references: readonly ProfilePreferenceReference[] = [],
): void {
  const snapshot = readProfilePreferences(references);
  writeSnapshot({ ...snapshot, saved: [] });
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
  writeSnapshot({ ...snapshot, recent });
}

export function removeRecentProfile(
  id: string,
  references: readonly ProfilePreferenceReference[] = [],
): void {
  const snapshot = readProfilePreferences(references);
  writeSnapshot({ ...snapshot, recent: snapshot.recent.filter((entry) => entry.id !== id) });
}

export function clearRecentProfiles(
  references: readonly ProfilePreferenceReference[] = [],
): void {
  const snapshot = readProfilePreferences(references);
  writeSnapshot({ ...snapshot, recent: [] });
}
