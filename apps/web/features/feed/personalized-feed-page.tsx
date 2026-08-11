import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock3, LockKeyhole } from "lucide-react";

import { GlobalNavigation } from "@/components/patterns/global-navigation";
import type { PublicLocale } from "@/foundation/content/locales";
import { ActivityTimeline } from "@/features/feed/activity-timeline";
import { MarkFeedViewedButton } from "@/features/feed/mark-feed-viewed-button";
import type { FeedPageData } from "@/features/feed/types";
import type { PandaDetail } from "@/lib/types";

interface PersonalizedFeedPageProps {
  locale: PublicLocale;
  state: "ready" | "blocked" | "unavailable";
  page?: FeedPageData;
  pandas: PandaDetail[];
}

const copy = {
  zh: {
    eyebrow: "我的熊猫动态",
    title: "看看你收藏的熊猫最近发生了什么",
    description: "这里按发布时间展示你当前收藏的熊猫、收藏前最多 90 天的历史，以及经过审核的全站消息。内容不按热度排序，打开页面也不会自动标记已读。",
    privacy: "此页面仅对你可见。吱熊猫不会公开你的收藏清单，也不会建立用户榜单或社交关系图。",
    staleTitle: "新动态还在陆续加入",
    staleBody: "最新熊猫资料已经发布，但部分相关动态还没有进入列表。当前内容仍可浏览，稍后刷新即可看到新增内容。",
    blockedTitle: "此账号暂时无法查看熊猫动态",
    blockedBody: "账号被冻结、暂停或进入删除流程时，私有动态会暂停。公开熊猫资料仍可浏览。",
    unavailableTitle: "熊猫动态暂时不可用",
    unavailableBody: "吱熊猫暂时无法读取你的私有动态，公开熊猫资料不受影响。",
    emptyTitle: "这里还没有熊猫动态",
    emptyBody: "从任意熊猫资料页收藏一只熊猫。之后发布的新动态会出现在这里，并附带最多 90 天、明确标注的较早记录。",
    browse: "去找一只熊猫收藏",
    next: "查看更早动态",
    privacyLabel: "吱熊猫私有页面",
  },
  en: {
    eyebrow: "My panda updates",
    title: "Updates from your favorite pandas",
    description: "Updates are shown in publication order from pandas you currently favorite, plus up to 90 days of earlier history and reviewed site announcements. Nothing is ranked, and opening this page does not mark updates as viewed.",
    privacy: "Only you can see this page. ZhiPanda does not publish your favorites or create member rankings or social graphs.",
    staleTitle: "New updates are still arriving",
    staleBody: "The latest panda information is published, but some related updates have not reached this list yet. The current list remains available; refresh later for new entries.",
    blockedTitle: "Panda updates are unavailable for this account",
    blockedBody: "Private updates pause while an account is frozen, suspended, or being deleted. Public panda profiles remain available.",
    unavailableTitle: "Panda updates are temporarily unavailable",
    unavailableBody: "ZhiPanda could not load your private updates. Public panda profiles are unaffected.",
    emptyTitle: "No panda updates yet",
    emptyBody: "Favorite a panda from any profile. New published updates will appear here, together with up to 90 days of clearly labelled earlier history.",
    browse: "Find a panda to favorite",
    next: "View earlier updates",
    privacyLabel: "Private ZhiPanda page",
  },
} as const;

export function PersonalizedFeedPage({
  locale,
  state,
  page,
  pandas,
}: PersonalizedFeedPageProps) {
  const t = copy[locale];
  const alternate = locale === "zh" ? "en" : "zh";
  const latestPublishedAt = page?.items[0]?.activity.published_at;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <GlobalNavigation
        locale={locale}
        active="feed"
        alternatePath={`/${alternate}/me/feed`}
      />
      <main id="main-content" className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 md:px-8 md:pt-16">
        <section className="rounded-3xl border border-[var(--pa-color-accent-border-10)] bg-[var(--pa-color-accent-fill-04)] p-6 md:p-10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            <LockKeyhole aria-hidden="true" className="size-4" />
            <span>{t.privacyLabel}</span>
          </div>
          <p className="mt-5 text-sm font-semibold text-[var(--accent)]">{t.eyebrow}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-[var(--fg)] md:text-5xl">
            {t.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)]">{t.description}</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">{t.privacy}</p>
        </section>

        {state === "blocked" ? (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <AlertTriangle aria-hidden="true" />{t.blockedTitle}
            </h2>
            <p className="mt-3 leading-7">{t.blockedBody}</p>
          </section>
        ) : null}

        {state === "unavailable" ? (
          <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-950">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <AlertTriangle aria-hidden="true" />{t.unavailableTitle}
            </h2>
            <p className="mt-3 leading-7">{t.unavailableBody}</p>
          </section>
        ) : null}

        {state === "ready" && page ? (
          <section className="mt-8" aria-labelledby="feed-heading">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 id="feed-heading" className="text-2xl font-semibold text-[var(--fg)]">
                  {t.eyebrow}
                </h2>
                {page.last_viewed_at ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
                    <Clock3 aria-hidden="true" className="size-4" />
                    {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(page.last_viewed_at))}
                  </p>
                ) : null}
              </div>
              {latestPublishedAt ? (
                <MarkFeedViewedButton locale={locale} viewedThroughAt={latestPublishedAt} />
              ) : null}
            </div>

            {page.projection_stale ? (
              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950" role="status">
                <p className="font-semibold">{t.staleTitle}</p>
                <p className="mt-1 text-sm leading-6">{t.staleBody}</p>
              </div>
            ) : null}

            <ActivityTimeline
              locale={locale}
              pandas={pandas}
              feedItems={page.items}
              emptyTitle={t.emptyTitle}
              emptyBody={t.emptyBody}
            />

            {!page.items.length ? (
              <Link
                href={`/${locale}/pandas` as Route}
                className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
              >
                {t.browse}<ArrowRight aria-hidden="true" />
              </Link>
            ) : null}

            {page.next_cursor ? (
              <Link
                href={`/${locale}/me/feed?cursor=${encodeURIComponent(page.next_cursor)}` as Route}
                className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full border border-[var(--pa-color-accent-border-14)] px-5 py-3 text-sm font-semibold text-[var(--accent)]"
                rel="next"
              >
                {t.next}<ArrowRight aria-hidden="true" />
              </Link>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
