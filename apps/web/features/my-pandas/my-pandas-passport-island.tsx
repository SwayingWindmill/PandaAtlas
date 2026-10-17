"use client";

import { ArrowRight, Clock3, Heart, LogIn, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { passportQueryOptions } from "@/features/fan/api/queries";
import { signInHref, useFanSession } from "@/features/fan/api/session";
import type { PassportEntry } from "@/features/fan/api/types";
import type {
  MyPandasCopy,
  MyPandasProfileSummary,
} from "@/features/my-pandas/my-pandas-view-model";
import {
  clearRecentProfiles,
  readProfilePreferences,
  subscribeToProfilePreferences,
  type StoredProfilePreferenceEntry,
} from "@/features/preferences/profile-preferences";
import type { PublicLocale } from "@/foundation/content/locales";
import { isEngagementUiEnabled } from "@/lib/engagement/config";

interface Props {
  locale: PublicLocale;
  profiles: MyPandasProfileSummary[];
  copy: MyPandasCopy;
}

type PassportState = "disabled" | "loading" | "ready" | "signed-out" | "error";

function formatDate(value: string, locale: PublicLocale): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
  }).format(new Date(timestamp));
}

function relationshipLabel(entry: PassportEntry, locale: PublicLocale): string {
  if (entry.relationshipState === "active") return locale === "zh" ? "已收藏" : "Favorited";
  if (entry.relationshipState === "inactive") return locale === "zh" ? "收藏历史" : "Favorite history";
  return locale === "zh" ? "贡献记录" : "Contribution record";
}

export function MyPandasPassportIsland({ locale, profiles, copy }: Props) {
  const engagementEnabled = isEngagementUiEnabled();
  const session = useFanSession(engagementEnabled);
  const passportQuery = useQuery({ ...passportQueryOptions, enabled: engagementEnabled && session.status === "ready" });
  const [recent, setRecent] = useState<StoredProfilePreferenceEntry[]>([]);
  const references = useMemo(
    () => profiles.map((profile) => ({ id: profile.id, aliases: profile.aliases })),
    [profiles],
  );
  const profilesById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  // Recent visits live in this browser only.
  useEffect(() => {
    const refreshRecent = () => setRecent(readProfilePreferences(references).recent);
    refreshRecent();
    return subscribeToProfilePreferences(refreshRecent);
  }, [references]);

  const passportState: PassportState = !engagementEnabled
    ? "disabled"
    : session.status === "signed-out"
      ? "signed-out"
      : session.status === "blocked" || session.status === "unavailable" || passportQuery.isError
        ? "error"
        : passportQuery.isSuccess
          ? "ready"
          : "loading";
  const passport = passportQuery.data ?? [];

  return (
    <div className="my-pandas-local" data-testid="my-pandas-local-island">
      <section
        className="my-pandas-section"
        aria-labelledby="passport-title"
        data-testid="passport-section"
      >
        <div className="my-pandas-section-heading">
          <div>
            <p className="my-pandas-count">
              {locale === "zh" ? "私有账号记录" : "Private account records"}
            </p>
            <h2 id="passport-title">{copy.passportTitle}</h2>
            <p>{copy.passportDescription}</p>
          </div>
        </div>

        {passportState === "disabled" ? (
          <div className="my-pandas-empty">
            <Heart aria-hidden="true" />
            <p>
              {locale === "zh"
                ? "熊猫护照尚未在此环境启用。最近浏览仍只保存在当前浏览器。"
                : "Panda Passport is not enabled in this environment. Recent visits remain local."}
            </p>
          </div>
        ) : null}
        {passportState === "loading" ? <p role="status">{copy.loading}</p> : null}
        {passportState === "signed-out" ? (
          <div className="my-pandas-empty">
            <LogIn aria-hidden="true" />
            <p>{locale === "zh" ? "登录后可查看跨设备同步的收藏。" : "Sign in to view synced favorites."}</p>
            <Link href={signInHref(`/${locale}/me`) as Route}>
              {locale === "zh" ? "使用邮箱验证码登录" : "Sign in with email OTP"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : null}
        {passportState === "error" ? (
          <div className="my-pandas-empty">
            <Heart aria-hidden="true" />
            <p>{locale === "zh" ? "熊猫护照暂时无法读取。" : "Panda Passport is unavailable."}</p>
          </div>
        ) : null}
        {passportState === "ready" && !passport.length ? (
          <div className="my-pandas-empty">
            <Heart aria-hidden="true" />
            <p>
              {locale === "zh"
                ? "你的熊猫护照还没有收藏或贡献记录。"
                : "Your Panda Passport has no favorite or contribution records yet."}
            </p>
            <Link href={`/${locale}/pandas` as Route}>
              {copy.browsePandas}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : null}
        {passportState === "ready" && passport.length ? (
          <ul className="my-pandas-list">
            {passport.map((entry) => {
              const profile = profilesById.get(entry.pandaId);
              return (
                <li
                  className="my-pandas-card"
                  data-testid={`passport-entry-${entry.pandaId}`}
                  key={entry.pandaId}
                >
                  <div className="my-pandas-card-heading">
                    <span className="my-pandas-card-mark" aria-hidden="true"><Heart /></span>
                    <div>
                      <h3>{profile?.name ?? copy.unavailableTitle}</h3>
                      <p>{relationshipLabel(entry, locale)}</p>
                    </div>
                  </div>
                  {entry.firstFollowedAt ? (
                    <p>
                      {locale === "zh" ? "首次收藏" : "First favorited"}: {formatDate(entry.firstFollowedAt, locale)}
                    </p>
                  ) : null}
                  {entry.contributionCount > 0 ? (
                    <p>
                      {locale === "zh" ? "贡献记录" : "Contributions"}: {entry.contributionCount}
                    </p>
                  ) : null}
                  {profile ? (
                    <Link href={profile.href as Route} className="my-pandas-primary-action">
                      {copy.openProfile}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section
        className="my-pandas-section"
        aria-labelledby="recent-pandas-title"
        data-testid="recent-pandas-section"
      >
        <div className="my-pandas-section-heading">
          <div>
            <p className="my-pandas-count">{copy.localCount}: {recent.length}</p>
            <h2 id="recent-pandas-title">{copy.recentTitle}</h2>
            <p>{copy.recentDescription}</p>
          </div>
          <button
            type="button"
            className="my-pandas-clear-action"
            disabled={!recent.length}
            onClick={() => clearRecentProfiles()}
          >
            <Trash2 aria-hidden="true" />
            {copy.clearRecent}
          </button>
        </div>
        {recent.length ? (
          <ul className="my-pandas-list">
            {recent.map((entry) => {
              const profile = profilesById.get(entry.id);
              return (
                <li
                  className="my-pandas-card"
                  data-testid={`recent-profile-${entry.id}`}
                  key={entry.id}
                >
                  <div className="my-pandas-card-heading">
                    <span className="my-pandas-card-mark" aria-hidden="true"><Clock3 /></span>
                    <h3>{profile?.name ?? copy.unavailableTitle}</h3>
                  </div>
                  {profile ? (
                    <Link href={profile.href as Route} className="my-pandas-primary-action">
                      {copy.openProfile}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="my-pandas-empty">
            <Clock3 aria-hidden="true" />
            <p>{copy.emptyRecent}</p>
          </div>
        )}
      </section>
    </div>
  );
}
