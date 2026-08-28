"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ContributionApiError, listSubmissions } from "./api";
import type { Locale, V2ContributionRecord } from "./types";

interface SubmissionDashboardProps {
  locale: Locale;
}

const copy = {
  zh: {
    eyebrow: "分享熊猫资料",
    title: "我的提交",
    body: "这里显示已经正式提交到 V2 审核队列的资料。服务器草稿已不再保留。",
    create: "提交新资料",
    loading: "正在加载…",
    signedOut: "登录后可查看私有提交。",
    signIn: "登录",
    error: "无法读取提交。",
    emptyTitle: "还没有正式提交",
    emptyBody: "从一只已经收录的熊猫开始，提交纠错或补充有来源的信息。",
    correction: "资料纠错",
    sourced: "有来源的新信息",
    revision: "修订",
    submitted: "提交时间",
    release: "公开版本",
    details: "查看详情",
  },
  en: {
    eyebrow: "Share panda information",
    title: "My submissions",
    body: "This page lists contributions formally submitted to the V2 review queue. Server-side drafts are no longer retained.",
    create: "Share new information",
    loading: "Loading…",
    signedOut: "Sign in to view private submissions.",
    signIn: "Sign in",
    error: "Could not load submissions.",
    emptyTitle: "No formal submissions yet",
    emptyBody: "Start with a panda already included in ZhiPanda, then submit a correction or sourced update.",
    correction: "Information correction",
    sourced: "Sourced information",
    revision: "Revision",
    submitted: "Submitted",
    release: "Public version",
    details: "View details",
  },
} as const;

export function SubmissionDashboard({ locale }: SubmissionDashboardProps) {
  const t = copy[locale];
  const [items, setItems] = useState<V2ContributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    let active = true;
    void listSubmissions()
      .then((result) => {
        if (active) setItems(result.data.items);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ContributionApiError && reason.status === 401) setRequiresLogin(true);
        setError(reason instanceof Error ? reason.message : t.error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t.error]);

  return (
    <section className="contribution-panel" aria-labelledby="submission-dashboard-heading">
      <header className="contribution-panel__heading">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 id="submission-dashboard-heading">{t.title}</h1>
          <p>{t.body}</p>
        </div>
        <Link className="button-primary" href={`/${locale}/contribute`}>{t.create}</Link>
      </header>

      {loading ? <p role="status">{t.loading}</p> : null}
      {requiresLogin ? (
        <p className="contribution-message contribution-message--notice">
          {t.signedOut} <Link href={`/auth/login?next=/${locale}/me/submissions`}>{t.signIn}</Link>
        </p>
      ) : null}
      {error && !requiresLogin ? <p className="contribution-message contribution-message--error" role="alert">{error}</p> : null}

      {!loading && !requiresLogin && items.length === 0 ? (
        <div className="contribution-empty">
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
        </div>
      ) : null}

      <div className="contribution-list">
        {items.map((item) => (
          <article key={item.submissionId} className="contribution-list-item">
            <div>
              <span className={`contribution-status contribution-status--${item.status}`}>{item.status}</span>
              <h2>{item.submissionType === "correction" ? t.correction : t.sourced}</h2>
              <p className="contribution-list-item__target">{item.targetPandaId}</p>
            </div>
            <dl>
              <div><dt>{t.revision}</dt><dd>{item.revisionNumber}</dd></div>
              <div><dt>{t.release}</dt><dd>{item.publicVersionSeen}</dd></div>
              <div><dt>{t.submitted}</dt><dd>{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { dateStyle: "medium" }).format(new Date(item.submittedAt))}</dd></div>
            </dl>
            <Link href={`/${locale}/me/submissions/${item.submissionId}`}>{t.details}</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
