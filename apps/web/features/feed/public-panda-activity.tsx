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
        {locale === "zh" ? "公开动态" : "Public Activity"}
      </p>
      <h2 id="panda-activity-heading" className="mt-2 text-2xl font-semibold text-[var(--fg)] md:text-3xl">
        {locale === "zh" ? `${name} 的时间线` : `${name}'s timeline`}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
        {locale === "zh"
          ? "仅显示来自已发布档案或授权编辑公告的公开安全动态，按发布时间排列。更正和撤回会明确标注。"
          : "Only public-safe Activity from published Archive releases or authorized editorial announcements is shown, ordered by publication time with explicit corrections and retractions."}
      </p>
      <div className="mt-6">
        {unavailable ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950" role="note">
            <p className="font-semibold">
              {locale === "zh" ? "公开动态暂时不可用" : "Public Activity is temporarily unavailable"}
            </p>
            <p className="mt-2 text-sm leading-7">
              {locale === "zh"
                ? "档案主体仍然可用；Activity 投影恢复后，这里会重新显示经过审核的动态。"
                : "The Archive profile remains available. Reviewed Activity will return when the projection service recovers."}
            </p>
          </div>
        ) : (
          <div>
            <ActivityTimeline
              locale={locale}
              pandas={pandas}
              activities={activity?.items ?? []}
              emptyTitle={locale === "zh" ? "暂无公开动态" : "No public Activity yet"}
              emptyBody={
                locale === "zh"
                  ? "档案发布经过审核的新动态后会显示在这里。"
                  : "Reviewed Activity will appear here after Archive publication."
              }
            />
            {activity?.next_cursor ? (
              <Link
                href={`/${locale}/pandas/${panda.slug}?activity_cursor=${encodeURIComponent(activity.next_cursor)}#panda-activity-heading` as Route}
                rel="next"
                className="mx-auto mt-6 flex w-fit rounded-full border border-[var(--pa-color-accent-border-14)] px-5 py-3 text-sm font-semibold text-[var(--accent)]"
              >
                {locale === "zh" ? "查看更早动态" : "View earlier Activity"}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
