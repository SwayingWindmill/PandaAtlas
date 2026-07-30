"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ContributionApiError, getAnalytics, listSubmissions } from "./api";
import { localeText, statusLabel } from "./copy";
import type { ContributorAnalytics, Locale, SubmissionSummary } from "./types";

interface SubmissionDashboardProps {
  locale: Locale;
}

export function SubmissionDashboard({ locale }: SubmissionDashboardProps) {
  const [items, setItems] = useState<SubmissionSummary[]>([]);
  const [analytics, setAnalytics] = useState<ContributorAnalytics | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const t = useCallback(
    (zh: string, en: string) => localeText(locale, zh, en),
    [locale],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listSubmissions(), getAnalytics()])
      .then(([page, summary]) => {
        if (cancelled) return;
        setItems(page.data.items);
        setNextCursor(page.data.next_cursor);
        setAnalytics(summary.data);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ContributionApiError && reason.status === 401) setRequiresLogin(true);
        setError(reason instanceof Error ? reason.message : t("加载失败", "Could not load submissions"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listSubmissions(nextCursor);
      setItems((current) => [...current, ...page.data.items]);
      setNextCursor(page.data.next_cursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("加载失败", "Could not load more"));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="contribution-panel" aria-labelledby="submission-dashboard-heading">
      <header className="contribution-panel__heading">
        <div>
          <p className="eyebrow">{t("分享熊猫资料", "Share panda information")}</p>
          <h1 id="submission-dashboard-heading">{t("我的提交", "My submissions")}</h1>
          <p>{t("这里仅显示你自己的私有草稿、提交版本和处理状态。", "Only your private drafts, submitted versions, and review status appear here.")}</p>
        </div>
        <Link className="button-primary" href={`/${locale}/contribute`}>
          {t("提交新资料", "Share new information")}
        </Link>
      </header>

      {analytics ? (
        <dl className="contribution-analytics">
          <div><dt>{t("全部", "Total")}</dt><dd>{analytics.total}</dd></div>
          <div><dt>{t("处理中", "Open")}</dt><dd>{analytics.open_count}</dd></div>
          <div><dt>{t("需要操作", "Action required")}</dt><dd>{analytics.action_required_count}</dd></div>
        </dl>
      ) : null}

      {loading ? <p role="status">{t("正在加载…", "Loading…")}</p> : null}
      {requiresLogin ? (
        <p className="contribution-message contribution-message--notice">
          {t("登录后可查看私有提交。", "Sign in to view private submissions.")} {" "}
          <Link href={`/auth/login?next=/${locale}/me/submissions`}>{t("登录", "Sign in")}</Link>
        </p>
      ) : null}
      {error && !requiresLogin ? <p className="contribution-message contribution-message--error" role="alert">{error}</p> : null}

      {!loading && !requiresLogin && items.length === 0 ? (
        <div className="contribution-empty">
          <h2>{t("还没有提交", "No submissions yet")}</h2>
          <p>{t("从一只已经收录的熊猫开始，提交纠错或补充有来源的信息。", "Start with a panda already included in ZhiPanda, then submit a correction or sourced update.")}</p>
        </div>
      ) : null}

      <div className="contribution-list">
        {items.map((item) => (
          <article key={item.submission_id} className="contribution-list-item">
            <div>
              <span className={`contribution-status contribution-status--${item.contributor_status}`}>
                {statusLabel(item.contributor_status, locale)}
              </span>
              <h2>{item.submission_type === "correction" ? t("资料纠错", "Information correction") : t("有来源的新信息", "Sourced information")}</h2>
              <p className="contribution-list-item__target">{item.target_id}</p>
              {item.user_visible_reason ? <p>{item.user_visible_reason}</p> : null}
            </div>
            <dl>
              <div><dt>{t("版本", "Version")}</dt><dd>v{item.version}</dd></div>
              <div><dt>{t("修订", "Revisions")}</dt><dd>{item.latest_revision_number}</dd></div>
              <div><dt>{t("更新", "Updated")}</dt><dd>{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { dateStyle: "medium" }).format(new Date(item.updated_at))}</dd></div>
            </dl>
            <Link href={`/${locale}/me/submissions/${item.submission_id}`}>
              {item.contributor_status === "action_required" ? t("补充信息", "Respond") : t("查看详情", "View details")}
            </Link>
          </article>
        ))}
      </div>

      {nextCursor ? (
        <div className="contribution-actions">
          <button type="button" className="button-secondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? t("正在加载…", "Loading…") : t("加载更多", "Load more")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
