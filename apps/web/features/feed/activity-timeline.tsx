import type { PublicLocale } from "@/foundation/content/locales";
import { ActivityCard } from "@/features/feed/activity-card";
import type { ActivityItem, FeedItemData } from "@/features/feed/types";
import type { PandaDetail } from "@/lib/types";

interface ActivityTimelineProps {
  locale: PublicLocale;
  pandas: PandaDetail[];
  activities?: ActivityItem[];
  feedItems?: FeedItemData[];
  emptyTitle?: string;
  emptyBody?: string;
}

export function ActivityTimeline({
  locale,
  pandas,
  activities,
  feedItems,
  emptyTitle,
  emptyBody,
}: ActivityTimelineProps) {
  const count = feedItems?.length ?? activities?.length ?? 0;
  if (!count) {
    return (
      <section className="rounded-3xl border border-dashed border-[var(--pa-color-accent-border-14)] bg-[var(--pa-color-accent-fill-04)] p-8 text-center">
        <h2 className="text-xl font-semibold text-[var(--fg)]">
          {emptyTitle ?? (locale === "zh" ? "暂无公开动态" : "No public Activity yet")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">
          {emptyBody ?? (
            locale === "zh"
              ? "经过审核的档案动态发布后会显示在这里。"
              : "Reviewed Archive Activity will appear here after publication."
          )}
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5" role="feed" aria-busy="false">
      {feedItems?.map((item) => (
        <ActivityCard
          key={item.activity.activity_id}
          locale={locale}
          activity={item.activity}
          pandas={pandas}
          attribution={item.attribution}
          isPinned={item.is_pinned}
          isNew={item.is_new}
          deletedTargetIds={item.deleted_target_ids}
        />
      ))}
      {activities?.map((activity) => (
        <ActivityCard
          key={activity.activity_id}
          locale={locale}
          activity={activity}
          pandas={pandas}
        />
      ))}
    </div>
  );
}
