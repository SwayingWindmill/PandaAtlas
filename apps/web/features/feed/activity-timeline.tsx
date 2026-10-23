import type { PublicLocale } from "@/foundation/content/locales";
import { ActivityCard } from "@/features/feed/activity-card";
import type { ActivityItem, FeedItemData } from "@/features/feed/types";
import type { PandaListItem } from "@/lib/types";

interface ActivityTimelineProps {
  locale: PublicLocale;
  pandas: PandaListItem[];
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
      <section className="rounded-[var(--pa-radius-lg)] bg-[var(--pa-color-surface-subtle)] p-5 text-[var(--pa-color-ink-muted)]">
        <h3 className="text-base font-semibold">
          {emptyTitle ?? (locale === "zh" ? "还没有动态" : "No updates yet")}
        </h3>
        {emptyBody === "" ? null : (
          <p className="mt-1 text-base leading-7">
            {emptyBody ?? (
              locale === "zh"
                ? "你关心的熊猫有新动态时，会显示在这里。"
                : "Updates from the pandas you follow will appear here."
            )}
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="grid gap-3" role="feed" aria-busy="false">
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
