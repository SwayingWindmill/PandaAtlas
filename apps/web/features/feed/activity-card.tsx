import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, History, Pin, RotateCcw, Sparkles } from "lucide-react";

import type { PublicLocale } from "@/foundation/content/locales";
import type { ActivityItem, FeedAttribution } from "@/features/feed/types";
import type { PandaListItem } from "@/lib/types";

interface ActivityCardProps {
  locale: PublicLocale;
  activity: ActivityItem;
  pandas: PandaListItem[];
  attribution?: FeedAttribution;
  isPinned?: boolean;
  isNew?: boolean;
  deletedTargetIds?: string[];
}

const copy = {
  zh: {
    retracted: "已撤回",
    correction: "更正",
    pinned: "置顶",
    new: "新动态",
    history: "收藏前的动态",
    deleted: "资料已下线",
    withdrawnBody: "这条动态已撤回。",
    backfill: "早期记录",
  },
  en: {
    retracted: "Retracted",
    correction: "Correction",
    pinned: "Pinned",
    new: "New",
    history: "Before you favorited",
    deleted: "Profile removed",
    withdrawnBody: "This update was retracted.",
    backfill: "Earlier record",
  },
} as const;

function localizedSnapshot(activity: ActivityItem, locale: PublicLocale) {
  const tag = locale === "zh" ? "zh-CN" : "en";
  return activity.localized_snapshots.find((item) => item.locale === tag)
    ?? activity.localized_snapshots.find((item) => item.locale === "zh-CN")
    ?? activity.localized_snapshots[0];
}

function dateLabel(value: string, locale: PublicLocale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function ActivityCard({
  locale,
  activity,
  pandas,
  attribution,
  isPinned = false,
  isNew = false,
  deletedTargetIds = [],
}: ActivityCardProps) {
  const t = copy[locale];
  const snapshot = localizedSnapshot(activity, locale);
  const retracted = activity.retraction_state === "retracted";
  const correction = activity.activity_type === "archive.profile_corrected";
  const pandaById = new Map(pandas.map((panda) => [panda.id, panda]));

  return (
    <article
      className="rounded-[var(--pa-radius-lg)] bg-[var(--pa-color-surface-subtle)] p-5 md:p-6"
      data-testid="activity-card"
      data-activity-id={activity.activity_id}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold empty:hidden">
        {isNew ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pa-color-highlight-soft)] px-3 py-1 text-[var(--pa-color-highlight-text)]">
            <Sparkles aria-hidden="true" className="size-3.5" />{t.new}
          </span>
        ) : null}
        {isPinned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--amber-3)] px-3 py-1 text-[var(--amber-11)]">
            <Pin aria-hidden="true" className="size-3.5" />{t.pinned}
          </span>
        ) : null}
        {correction ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pa-color-surface)] px-3 py-1 text-[var(--pa-color-ink)]">
            <RotateCcw aria-hidden="true" className="size-3.5" />{t.correction}
          </span>
        ) : null}
        {attribution === "history" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pa-color-surface)] px-3 py-1 text-[var(--pa-color-ink-muted)]">
            <History aria-hidden="true" className="size-3.5" />{t.history}
          </span>
        ) : null}
        {activity.is_backfill ? (
          <span className="rounded-full bg-[var(--pa-color-surface)] px-3 py-1 text-[var(--pa-color-ink-muted)]">{t.backfill}</span>
        ) : null}
      </div>

      <div className="mt-3">
        <h3 className="text-xl font-bold leading-snug text-[var(--pa-color-ink)]">
          {retracted ? t.retracted : snapshot.title}
        </h3>
        <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--pa-color-ink-muted)]">
          {retracted
            ? [t.withdrawnBody, activity.retraction_reason].filter(Boolean).join(" ")
            : snapshot.summary}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <time dateTime={activity.occurred_at} className="mr-2 text-xs text-[var(--pa-color-ink-muted)]">
          {dateLabel(activity.occurred_at, locale)}
        </time>
        {activity.targets.map((target) => {
          if (target.target_type !== "panda") {
            return (
              <span key={`${target.target_type}:${target.target_id}`} className="rounded-full border-[0.5px] border-[var(--pa-color-line-strong)] px-3 py-1 text-xs">
                {target.target_id}
              </span>
            );
          }
          const panda = pandaById.get(target.target_id);
          const deleted = deletedTargetIds.includes(target.target_id) || !panda;
          if (deleted) {
            return (
              <span
                key={`${target.target_type}:${target.target_id}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--red-3)] px-3 py-1 text-xs text-[var(--red-11)]"
              >
                <AlertTriangle aria-hidden="true" className="size-3.5" />{t.deleted}
              </span>
            );
          }
          const name = locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
          return (
            <Link
              key={`${target.target_type}:${target.target_id}`}
              href={`/${locale}/pandas/${panda.slug}` as Route}
              className="rounded-full border-[0.5px] border-[var(--pa-color-line-strong)] bg-[var(--pa-color-surface)] px-3 py-1 text-xs font-semibold text-[var(--pa-color-ink)] hover:border-[var(--pa-color-ink)]"
            >
              {name}
            </Link>
          );
        })}
      </div>

    </article>
  );
}
