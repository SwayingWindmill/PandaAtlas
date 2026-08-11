import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, History, Pin, RotateCcw, Sparkles } from "lucide-react";

import type { PublicLocale } from "@/foundation/content/locales";
import type { ActivityItem, FeedAttribution } from "@/features/feed/types";
import type { PandaDetail } from "@/lib/types";

interface ActivityCardProps {
  locale: PublicLocale;
  activity: ActivityItem;
  pandas: PandaDetail[];
  attribution?: FeedAttribution;
  isPinned?: boolean;
  isNew?: boolean;
  deletedTargetIds?: string[];
}

const copy = {
  zh: {
    retracted: "动态已撤回",
    correction: "公开更正",
    pinned: "全站置顶",
    new: "新动态",
    history: "收藏前 90 天历史",
    historyBody: "这条动态发生在你收藏之前，因此作为较早历史单独标注。",
    deleted: "熊猫资料已不可用",
    published: "发布于",
    occurred: "发生于",
    source: "公开来源",
    sourceCount: (count: number) => `${count} 条公开来源`,
    withdrawnBody: "原动态不再公开展示。以下原因来自已审核撤回记录。",
    noReason: "公开来源已撤回，未发布更多说明。",
    backfill: "历史回填",
  },
  en: {
    retracted: "Activity retracted",
    correction: "Public correction",
    pinned: "Sitewide pin",
    new: "New",
    history: "90-day pre-favorite history",
    historyBody: "This update was published before you favorited the panda, so it is labelled as earlier history.",
    deleted: "Panda profile is no longer available",
    published: "Published",
    occurred: "Occurred",
    source: "Public sources",
    sourceCount: (count: number) => `${count} public source${count === 1 ? "" : "s"}`,
    withdrawnBody: "The original update is no longer publicly shown. This reason comes from the reviewed retraction record.",
    noReason: "The public source was withdrawn without a published explanation.",
    backfill: "Historical backfill",
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
    timeStyle: "short",
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
      className="rounded-3xl border border-[var(--pa-color-accent-border-10)] bg-[var(--card)] p-5 shadow-sm md:p-6"
      data-testid="activity-card"
      data-activity-id={activity.activity_id}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {isNew ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pa-color-accent-fill-12)] px-3 py-1 text-[var(--accent-strong)]">
            <Sparkles aria-hidden="true" className="size-3.5" />{t.new}
          </span>
        ) : null}
        {isPinned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-amber-900">
            <Pin aria-hidden="true" className="size-3.5" />{t.pinned}
          </span>
        ) : null}
        {correction ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-900">
            <RotateCcw aria-hidden="true" className="size-3.5" />{t.correction}
          </span>
        ) : null}
        {attribution === "history" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-stone-700">
            <History aria-hidden="true" className="size-3.5" />{t.history}
          </span>
        ) : null}
        {activity.is_backfill ? (
          <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">{t.backfill}</span>
        ) : null}
      </div>

      <div className="mt-4">
        <h3 className="text-xl font-semibold leading-tight text-[var(--fg)] md:text-2xl">
          {retracted ? t.retracted : snapshot.title}
        </h3>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-base">
          {retracted
            ? `${t.withdrawnBody} ${activity.retraction_reason ?? t.noReason}`
            : snapshot.summary}
        </p>
        {attribution === "history" ? (
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{t.historyBody}</p>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold text-[var(--fg)]">{t.occurred}: </dt>
          <dd className="inline">{dateLabel(activity.occurred_at, locale)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-[var(--fg)]">{t.published}: </dt>
          <dd className="inline">{dateLabel(activity.published_at, locale)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        {activity.targets.map((target) => {
          if (target.target_type !== "panda") {
            return (
              <span key={`${target.target_type}:${target.target_id}`} className="rounded-full border px-3 py-1 text-xs">
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
                className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-800"
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
              className="rounded-full border border-[var(--pa-color-accent-border-14)] px-3 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--pa-color-accent-fill-06)]"
            >
              {name}
            </Link>
          );
        })}
      </div>

      {activity.provenance.public_reference_ids.length ? (
        <p className="mt-5 text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--fg)]">{t.source}: </span>
          {t.sourceCount(activity.provenance.public_reference_ids.length)}
        </p>
      ) : null}
    </article>
  );
}
