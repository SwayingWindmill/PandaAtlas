import type { Route } from "next";
import Link from "next/link";

import type { PublicLocale } from "@/foundation/content/locales";
import { ActivityTimeline } from "@/features/feed/activity-timeline";
import type { ActivityPageData } from "@/features/feed/types";
import type { PandaDetail, PandaListItem } from "@/lib/types";

interface PublicPandaActivityProps {
  locale: PublicLocale;
  panda: PandaDetail;
  pandas: PandaListItem[];
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
  return (
    <section aria-labelledby="panda-activity-heading" data-testid="public-panda-activity">
      <h2 id="panda-activity-heading" className="text-xl font-extrabold leading-snug text-[var(--pa-color-ink)]">
        {locale === "zh" ? "熊猫动态" : "Panda updates"}
      </h2>
      <div className="mt-5">
        {unavailable ? (
          <p className="rounded-[var(--pa-radius-lg)] bg-[var(--pa-color-warning-fill-09)] p-5 text-[var(--amber-12)]" role="note">
            {locale === "zh" ? "动态暂时无法加载，请稍后再来看看。" : "Updates can't be loaded right now. Please check back later."}
          </p>
        ) : (
          <div>
            <ActivityTimeline
              locale={locale}
              pandas={pandas}
              activities={activity?.items ?? []}
              emptyTitle={locale === "zh" ? "还没有动态" : "No updates yet"}
              emptyBody=""
            />
            {activity?.next_cursor ? (
              <Link
                href={`/${locale}/pandas/${panda.slug}?activity_cursor=${encodeURIComponent(activity.next_cursor)}#panda-activity-heading` as Route}
                rel="next"
                className="mx-auto mt-6 flex h-11 w-fit items-center rounded-full border-[0.5px] border-[var(--pa-color-line-strong)] px-5 font-semibold hover:bg-[var(--pa-color-surface-subtle)]"
              >
                {locale === "zh" ? "查看更早的动态" : "View earlier updates"}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
