"use client";

import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Bookmark, Clock3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  clearRecentProfiles,
  clearSavedProfiles,
  readProfilePreferences,
  removeRecentProfile,
  removeSavedProfile,
  subscribeToProfilePreferences,
  type ProfilePreferencesSnapshot,
  type StoredProfilePreferenceEntry,
} from "@/features/preferences/profile-preferences";
import type {
  MyPandasCopy,
  MyPandasProfileSummary,
} from "@/features/my-pandas/my-pandas-view-model";
import type { PublicLocale } from "@/foundation/content/locales";

interface MyPandasIslandProps {
  locale: PublicLocale;
  profiles: MyPandasProfileSummary[];
  copy: MyPandasCopy;
}

type SavedSort = "recent" | "name";

interface ResolvedLocalEntry {
  stored: StoredProfilePreferenceEntry;
  profile: MyPandasProfileSummary | null;
}

const EMPTY_PREFERENCES: ProfilePreferencesSnapshot = { saved: [], recent: [] };

function formatLocalTime(value: string, locale: PublicLocale): string | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp < Date.UTC(2000, 0, 1)) return null;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function LocalProfileCard({
  entry,
  locale,
  copy,
  timeLabel,
  onRemove,
  testId,
}: {
  entry: ResolvedLocalEntry;
  locale: PublicLocale;
  copy: MyPandasCopy;
  timeLabel: string;
  onRemove: () => void;
  testId: string;
}) {
  const time = formatLocalTime(entry.stored.at, locale);
  const profile = entry.profile;

  if (!profile) {
    return (
      <li className="my-pandas-card my-pandas-card-unavailable" data-testid={testId}>
        <div className="my-pandas-card-heading">
          <span className="my-pandas-card-mark" aria-hidden="true"><Trash2 /></span>
          <div>
            <h3>{copy.unavailableTitle}</h3>
            <p className="my-pandas-stable-id"><strong>{copy.stableId}:</strong> {entry.stored.id}</p>
          </div>
        </div>
        <p>{copy.unavailableBody}</p>
        <button type="button" className="my-pandas-secondary-action" onClick={onRemove}>
          <Trash2 aria-hidden="true" />
          {copy.remove}
        </button>
      </li>
    );
  }

  return (
    <li className="my-pandas-card" data-testid={testId}>
      <div className="my-pandas-card-heading">
        <span className="my-pandas-card-mark" aria-hidden="true"><Bookmark /></span>
        <div>
          <h3 lang={locale === "zh" ? "zh-CN" : "en"}>{profile.name}</h3>
          {profile.alternateName ? (
            <p className="my-pandas-alternate-name" lang={locale === "zh" ? "en" : "zh-CN"}>
              {profile.alternateName}
            </p>
          ) : null}
        </div>
      </div>
      <dl className="my-pandas-card-facts">
        <div><dt>{locale === "zh" ? "档案状态" : "Profile status"}</dt><dd>{profile.status}</dd></div>
        <div><dt>{locale === "zh" ? "当前公开地点" : "Current public place"}</dt><dd>{profile.currentPlace}</dd></div>
        {time ? <div><dt>{timeLabel}</dt><dd>{time}</dd></div> : null}
      </dl>
      <div className="my-pandas-card-actions">
        <Link href={profile.href as Route} className="my-pandas-primary-action">
          {copy.openProfile}
          <ArrowRight aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="my-pandas-secondary-action"
          onClick={onRemove}
          aria-label={`${copy.remove}: ${profile.name}`}
        >
          <Trash2 aria-hidden="true" />
          {copy.remove}
        </button>
      </div>
    </li>
  );
}

export function MyPandasIsland({ locale, profiles, copy }: MyPandasIslandProps) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState<ProfilePreferencesSnapshot>(EMPTY_PREFERENCES);
  const [savedSort, setSavedSort] = useState<SavedSort>("recent");
  const [feedback, setFeedback] = useState("");
  const references = useMemo(
    () => profiles.map((profile) => ({ id: profile.id, aliases: profile.aliases })),
    [profiles],
  );
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  useEffect(() => {
    const refresh = () => {
      setPreferences(readProfilePreferences(references));
      setReady(true);
    };
    refresh();
    return subscribeToProfilePreferences(refresh);
  }, [references]);

  const savedEntries = useMemo(() => {
    const resolved = preferences.saved.map((stored): ResolvedLocalEntry => ({
      stored,
      profile: profileById.get(stored.id) ?? null,
    }));
    if (savedSort === "name") {
      return [...resolved].sort((left, right) => {
        if (!left.profile && !right.profile) return left.stored.id.localeCompare(right.stored.id);
        if (!left.profile) return 1;
        if (!right.profile) return -1;
        return left.profile.name.localeCompare(right.profile.name, locale === "zh" ? "zh-CN" : "en");
      });
    }
    return resolved;
  }, [locale, preferences.saved, profileById, savedSort]);

  const recentEntries = useMemo(() => preferences.recent.map((stored): ResolvedLocalEntry => ({
    stored,
    profile: profileById.get(stored.id) ?? null,
  })), [preferences.recent, profileById]);

  function removeSaved(entry: ResolvedLocalEntry) {
    removeSavedProfile(entry.stored.id, references);
    setFeedback(`${copy.feedbackSavedRemoved}: ${entry.profile?.name ?? entry.stored.id}`);
  }

  function removeRecent(entry: ResolvedLocalEntry) {
    removeRecentProfile(entry.stored.id, references);
    setFeedback(`${copy.feedbackRecentRemoved}: ${entry.profile?.name ?? entry.stored.id}`);
  }

  if (!ready) {
    return <p className="my-pandas-loading" role="status">{copy.loading}</p>;
  }

  return (
    <div className="my-pandas-local" data-testid="my-pandas-local-island">
      <p className="sr-only" aria-live="polite">{feedback}</p>

      <section className="my-pandas-section" aria-labelledby="saved-pandas-title" data-testid="saved-pandas-section">
        <div className="my-pandas-section-heading">
          <div>
            <p className="my-pandas-count">{copy.localCount}: {savedEntries.length}</p>
            <h2 id="saved-pandas-title">{copy.savedTitle}</h2>
            <p>{copy.savedDescription}</p>
          </div>
          <div className="my-pandas-section-controls">
            <label>
              <span>{copy.sortLabel}</span>
              <select value={savedSort} onChange={(event) => setSavedSort(event.target.value as SavedSort)}>
                <option value="recent">{copy.sortRecent}</option>
                <option value="name">{copy.sortName}</option>
              </select>
            </label>
            <button
              type="button"
              className="my-pandas-clear-action"
              disabled={!savedEntries.length}
              onClick={() => {
                clearSavedProfiles(references);
                setFeedback(copy.feedbackSavedCleared);
              }}
            >
              <Trash2 aria-hidden="true" />
              {copy.clearSaved}
            </button>
          </div>
        </div>
        {savedEntries.length ? (
          <ul className="my-pandas-list">
            {savedEntries.map((entry) => (
              <LocalProfileCard
                key={entry.stored.id}
                entry={entry}
                locale={locale}
                copy={copy}
                timeLabel={copy.savedAt}
                onRemove={() => removeSaved(entry)}
                testId={`saved-profile-${entry.stored.id}`}
              />
            ))}
          </ul>
        ) : (
          <div className="my-pandas-empty">
            <Bookmark aria-hidden="true" />
            <p>{copy.emptySaved}</p>
            <Link href={`/${locale}/atlas` as Route}>{copy.browseAtlas}<ArrowRight aria-hidden="true" /></Link>
          </div>
        )}
      </section>

      <section className="my-pandas-section" aria-labelledby="recent-pandas-title" data-testid="recent-pandas-section">
        <div className="my-pandas-section-heading">
          <div>
            <p className="my-pandas-count">{copy.localCount}: {recentEntries.length}</p>
            <h2 id="recent-pandas-title">{copy.recentTitle}</h2>
            <p>{copy.recentDescription}</p>
          </div>
          <button
            type="button"
            className="my-pandas-clear-action"
            disabled={!recentEntries.length}
            onClick={() => {
              clearRecentProfiles(references);
              setFeedback(copy.feedbackRecentCleared);
            }}
          >
            <Trash2 aria-hidden="true" />
            {copy.clearRecent}
          </button>
        </div>
        {recentEntries.length ? (
          <ul className="my-pandas-list">
            {recentEntries.map((entry) => (
              <LocalProfileCard
                key={entry.stored.id}
                entry={entry}
                locale={locale}
                copy={copy}
                timeLabel={copy.viewedAt}
                onRemove={() => removeRecent(entry)}
                testId={`recent-profile-${entry.stored.id}`}
              />
            ))}
          </ul>
        ) : (
          <div className="my-pandas-empty">
            <Clock3 aria-hidden="true" />
            <p>{copy.emptyRecent}</p>
            <Link href={`/${locale}/atlas` as Route}>{copy.browseAtlas}<ArrowRight aria-hidden="true" /></Link>
          </div>
        )}
      </section>
    </div>
  );
}
