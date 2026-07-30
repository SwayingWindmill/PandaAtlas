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
    eyebrow: "我的关注动态",
    title: "按发布时间排列的熊猫动态",
    description: "仅根据你当前关注的熊猫、关注前 90 天历史和经过审核的全站置顶生成。没有排序分数，也不会因为打开页面而自动写入已读状态。",
    privacy: "此页面仅对当前账号可见，不会生成公开用户档案、榜单或社交关系页面。",
    staleTitle: "动态投影正在追赶",
    staleBody: "档案发布已成功，但部分新动态仍在投影。当前列表保持可用，稍后刷新即可看到新增内容。",
    blockedTitle: "账号当前无法读取关注动态",
    blockedBody: "账号被冻结、暂停或进入删除流程时，Feed 会停止读取和写入。公开熊猫档案仍可浏览。",
    unavailableTitle: "关注动态暂时不可用",
    unavailableBody: "Feed 数据库或投影服务暂时无法响应。公开档案不会受影响。",
    emptyTitle: "关注动态还是空的",
    emptyBody: "从任意熊猫档案页开始关注。关注后会显示新动态，并附带关注前 90 天的非归因历史。",
    browse: "浏览熊猫档案",
    next: "查看更早动态",
    privacyLabel: "私有账号页面",
  },
  en: {
    eyebrow: "My Follow Activity",
    title: "Panda Activity in publication order",
    description: "Built only from currently followed pandas, 90 days of pre-Follow history, and reviewed sitewide pins. There is no ranking score, and opening the page never writes viewed state automatically.",
    privacy: "This page is visible only to the current account. It does not create a public profile, leaderboard, or social graph.",
    staleTitle: "Activity projection is catching up",
    staleBody: "Archive publication succeeded, but some new Activity is still being projected. The current list remains available; refresh later for new entries.",
    blockedTitle: "This account cannot read Follow Activity",
    blockedBody: "Feed reads and writes stop while an account is frozen, suspended, or being deleted. Public panda profiles remain available.",
    unavailableTitle: "Follow Activity is temporarily unavailable",
    unavailableBody: "The Feed database or projection service could not respond. Public Archive pages are unaffected.",
    emptyTitle: "Your Follow Activity is empty",
    emptyBody: "Follow a panda from any profile. New Activity will appear with up to 90 days of clearly non-attributed pre-Follow history.",
    browse: "Browse panda profiles",
    next: "View earlier Activity",
    privacyLabel: "Private account page",
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
