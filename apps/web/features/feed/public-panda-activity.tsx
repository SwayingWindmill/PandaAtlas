import type { Route } from "next";
import Link from "next/link";

import type { PublicLocale } from "@/foundation/content/locales";
import { ActivityTimeline } from "@/features/feed/activity-timeline";
import type { ActivityPageData } from "@/features/feed/types";
import type { PandaDetail } from "@/lib/types";

interface PublicPandaActivityProps {
  locale: PublicLocale;
  panda: PandaDetail;
  pandas: PandaDetail[];
  activity?: ActivityPageData;
  unavailable?: boolean;
}

export function PublicPandaActivity({
  locale,
  panda,
  pandas,
  activity,
  unavailable = false,
}: PublicPandaActivityProps) {
  const name = locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
  return (
    <section
      className="mt-10 border-t border-[var(--pa-color-accent-border-10)] pt-8"
      aria-labelledby="panda-activity-heading"
      data-testid="public-panda-activity"
    >
      <p className="text-sm font-semibold text-[var(--accent)]">
        {locale === "zh" ? "熊猫动态" : "Panda updates"}
      </p>
      <h2 id="panda-activity-heading" className="mt-2 text-2xl font-semibold text-[var(--fg)] md:text-3xl">
        {locale === "zh" ? `${name} 的时间线` : `${name}'s timeline`}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
        {locale === "zh"
          ? "这里只显示已经审核并适合公开的熊猫动态，按发布时间排列。更正和撤回会明确标注。"
          : "Only reviewed, public-safe panda updates are shown here, ordered by publication time with clear corrections and retractions."}
      </p>
      <div className="mt-6">
        {unavailable ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950" role="note">
            <p className="font-semibold">
              {locale === "zh" ? "熊猫动态暂时不可用" : "Panda updates are temporarily unavailable"}
            </p>
            <p className="mt-2 text-sm leading-7">
              {locale === "zh"
                ? "熊猫资料仍然可以浏览；动态恢复后，经过审核的更新会重新显示在这里。"
                : "The panda profile remains available. Reviewed updates will return here when the update service recovers."}
            </p>
          </div>
        ) : (
          <div>
            <ActivityTimeline
              locale={locale}
              pandas={pandas}
              activities={activity?.items ?? []}
              emptyTitle={locale === "zh" ? "还没有公开动态" : "No public panda updates yet"}
              emptyBody={
                locale === "zh"
                  ? "这只熊猫有新的经审核动态后，会显示在这里。"
                  : "New reviewed updates for this panda will appear here."
              }
            />
            {activity?.next_cursor ? (
              <Link
                href={`/${locale}/pandas/${panda.slug}?activity_cursor=${encodeURIComponent(activity.next_cursor)}#panda-activity-heading` as Route}
                rel="next"
                className="mx-auto mt-6 flex w-fit rounded-full border border-[var(--pa-color-accent-border-14)] px-5 py-3 text-sm font-semibold text-[var(--accent)]"
              >
                {locale === "zh" ? "查看更早动态" : "View earlier updates"}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
