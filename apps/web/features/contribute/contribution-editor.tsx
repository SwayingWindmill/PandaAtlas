"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ContributionApiError, getSubmission, submitContribution } from "./api";
import type { Locale, SubmissionType, V2ContributionInput, V2ContributionRecord } from "./types";

interface PandaOption {
  id: string;
  label: string;
}

interface ContributionEditorProps {
  locale: Locale;
  submissionId?: string;
  publicVersion?: string;
  pandas?: PandaOption[];
}

const copy = {
  zh: {
    eyebrow: "分享熊猫资料",
    title: "提交纠错或有来源的新信息",
    intro: "提交后会直接进入审核队列。请在提交前确认要更正或补充的内容与来源。",
    information: "要更正或补充的内容",
    sources: "来源",
    privateEvidence: "私有证据",
    privateEvidenceNote: "私有证据附件暂不在这个提交表单中上传；请不要把私密材料填写到公开来源链接里。",
    type: "提交类型",
    correction: "资料纠错",
    sourced: "有来源的新信息",
    panda: "熊猫",
    field: "字段",
    value: "建议值",
    certainty: "确定性",
    confirmed: "已确认",
    provisional: "暂定",
    verified: "最后核验日期",
    sourceKind: "来源类型",
    sourceTitle: "来源标题",
    sourceLocator: "来源链接或书目定位",
    publisher: "发布者（可选）",
    publishedOn: "发布日期（可选）",
    submit: "提交审核",
    submitting: "正在提交…",
    required: "请完整填写熊猫、字段、建议值、核验日期、来源标题和来源定位。",
    unavailable: "当前公开版本不可用，暂时无法提交。",
    detailTitle: "提交详情",
    status: "状态",
    target: "目标熊猫",
    revision: "修订",
    release: "提交时公开版本",
    submittedAt: "提交时间",
    back: "返回我的提交",
    newSubmission: "提交新资料",
    loading: "正在读取提交…",
    notFound: "无法读取这个提交。",
  },
  en: {
    eyebrow: "Share panda information",
    title: "Submit a sourced correction or update",
    intro: "Submissions enter review immediately. Review the information to correct or add and its sources before submitting.",
    information: "Information to correct or add",
    sources: "Sources",
    privateEvidence: "Private evidence",
    privateEvidenceNote: "Private evidence attachments are not uploaded from this form yet; do not put private material in a public source locator.",
    type: "Submission type",
    correction: "Information correction",
    sourced: "Sourced new information",
    panda: "Panda",
    field: "Field",
    value: "Proposed value",
    certainty: "Certainty",
    confirmed: "Confirmed",
    provisional: "Provisional",
    verified: "Last verified date",
    sourceKind: "Source type",
    sourceTitle: "Source title",
    sourceLocator: "Source URL or bibliographic locator",
    publisher: "Publisher (optional)",
    publishedOn: "Publication date (optional)",
    submit: "Submit for review",
    submitting: "Submitting…",
    required: "Complete the panda, field, proposed value, verification date, source title, and source locator.",
    unavailable: "The current public release is unavailable, so contributions cannot be submitted right now.",
    detailTitle: "Submission details",
    status: "Status",
    target: "Target panda",
    revision: "Revision",
    release: "Public version at submission",
    submittedAt: "Submitted",
    back: "Back to my submissions",
    newSubmission: "Share new information",
    loading: "Loading submission…",
    notFound: "This submission could not be loaded.",
  },
} as const;

export function ContributionEditor({
  locale,
  submissionId,
  publicVersion,
  pandas = [],
}: ContributionEditorProps) {
  const t = copy[locale];
  const [record, setRecord] = useState<V2ContributionRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(submissionId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionType, setSubmissionType] = useState<SubmissionType>("correction");
  const [targetPandaId, setTargetPandaId] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [value, setValue] = useState("");
  const [certainty, setCertainty] = useState<"confirmed" | "provisional">("confirmed");
  const [lastVerifiedOn, setLastVerifiedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceKind, setSourceKind] = useState<"url" | "publication" | "document" | "other">("url");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceLocator, setSourceLocator] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishedOn, setPublishedOn] = useState("");
  const pandaLabel = useMemo(() => new Map(pandas.map((panda) => [panda.id, panda.label])), [pandas]);

  useEffect(() => {
    if (!submissionId) return;
    let active = true;
    void getSubmission(submissionId)
      .then((result) => {
        if (active) setRecord(result.data);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : t.notFound);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [submissionId, t.notFound]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (
      !publicVersion ||
      !targetPandaId ||
      !fieldKey.trim() ||
      !value.trim() ||
      !lastVerifiedOn ||
      !sourceTitle.trim() ||
      !sourceLocator.trim()
    ) {
      setError(publicVersion ? t.required : t.unavailable);
      return;
    }

    const sourceKey = `source-${crypto.randomUUID()}`;
    const body: V2ContributionInput = {
      submissionType,
      targetPandaId,
      publicVersionSeen: publicVersion,
      assertions: [{
        assertionKey: `assertion-${crypto.randomUUID()}`,
        fieldKey: fieldKey.trim(),
        value: value.trim(),
        certainty,
        lastVerifiedOn,
        sourceKeys: [sourceKey],
      }],
      sources: [{
        sourceKey,
        sourceKind,
        title: sourceTitle.trim(),
        locator: sourceLocator.trim(),
        ...(publisher.trim() ? { publisher: publisher.trim() } : {}),
        ...(publishedOn ? { publishedOn } : {}),
      }],
    };

    setBusy(true);
    try {
      const result = await submitContribution(body);
      window.location.assign(`/${locale}/me/submissions/${result.data.submissionId}`);
    } catch (reason) {
      if (reason instanceof ContributionApiError && reason.status === 401) {
        window.location.assign(`/auth/login?next=${encodeURIComponent(`/${locale}/contribute`)}`);
        return;
      }
      setError(reason instanceof Error ? reason.message : t.required);
      setBusy(false);
    }
  }

  if (submissionId) {
    return (
      <section className="contribution-panel" aria-labelledby="submission-detail-heading">
        <header className="contribution-panel__heading">
          <div>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1 id="submission-detail-heading">{t.detailTitle}</h1>
          </div>
          <Link className="button-secondary" href={`/${locale}/me/submissions`}>{t.back}</Link>
        </header>
        {loading ? <p role="status">{t.loading}</p> : null}
        {error ? <p className="contribution-message contribution-message--error" role="alert">{error}</p> : null}
        {record ? (
          <div className="contribution-list">
            <article className="contribution-list-item">
              <div>
                <span className={`contribution-status contribution-status--${record.status}`}>{record.status}</span>
                <h2>{record.submissionType === "correction" ? t.correction : t.sourced}</h2>
                <p className="contribution-list-item__target">{pandaLabel.get(record.targetPandaId) ?? record.targetPandaId}</p>
              </div>
              <dl>
                <div><dt>{t.status}</dt><dd>{record.status}</dd></div>
                <div><dt>{t.target}</dt><dd>{record.targetPandaId}</dd></div>
                <div><dt>{t.revision}</dt><dd>{record.revisionNumber}</dd></div>
                <div><dt>{t.release}</dt><dd>{record.publicVersionSeen}</dd></div>
                <div><dt>{t.submittedAt}</dt><dd>{new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.submittedAt))}</dd></div>
              </dl>
            </article>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="contribution-panel" aria-labelledby="contribution-editor-heading">
      <header className="contribution-panel__heading">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 id="contribution-editor-heading">{t.title}</h1>
          <p>{t.intro}</p>
        </div>
        <Link className="button-secondary" href={`/${locale}/me/submissions`}>{t.back}</Link>
      </header>

      {!publicVersion ? <p className="contribution-message contribution-message--notice">{t.unavailable}</p> : null}
      {error ? <p className="contribution-message contribution-message--error" role="alert">{error}</p> : null}

      <form className="contribution-form" onSubmit={handleSubmit}>
        <label>
          <span>{t.type}</span>
          <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as SubmissionType)}>
            <option value="correction">{t.correction}</option>
            <option value="sourced_information">{t.sourced}</option>
          </select>
        </label>
        <label>
          <span>{t.panda}</span>
          <select required value={targetPandaId} onChange={(event) => setTargetPandaId(event.target.value)}>
            <option value="">—</option>
            {pandas.map((panda) => <option key={panda.id} value={panda.id}>{panda.label}</option>)}
          </select>
        </label>
        <fieldset className="contribution-fieldset">
          <legend>{t.information}</legend>
          <label>
            <span>{t.field}</span>
          <input required maxLength={160} value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} placeholder="birth_date" />
        </label>
        <label>
          <span>{t.value}</span>
          <textarea required value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
        </label>
        <label>
          <span>{t.certainty}</span>
          <select value={certainty} onChange={(event) => setCertainty(event.target.value as "confirmed" | "provisional")}>
            <option value="confirmed">{t.confirmed}</option>
            <option value="provisional">{t.provisional}</option>
          </select>
        </label>
        <label>
          <span>{t.verified}</span>
          <input required type="date" value={lastVerifiedOn} onChange={(event) => setLastVerifiedOn(event.target.value)} />
        </label>
        </fieldset>
        <fieldset className="contribution-fieldset">
          <legend>{t.sources}</legend>
          <label>
            <span>{t.sourceKind}</span>
          <select value={sourceKind} onChange={(event) => setSourceKind(event.target.value as typeof sourceKind)}>
            <option value="url">URL</option>
            <option value="publication">Publication</option>
            <option value="document">Document</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          <span>{t.sourceTitle}</span>
          <input required maxLength={500} value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
        </label>
        <label>
          <span>{t.sourceLocator}</span>
          <input required maxLength={2000} value={sourceLocator} onChange={(event) => setSourceLocator(event.target.value)} />
        </label>
        <label>
          <span>{t.publisher}</span>
          <input maxLength={500} value={publisher} onChange={(event) => setPublisher(event.target.value)} />
        </label>
        <label>
          <span>{t.publishedOn}</span>
          <input type="date" value={publishedOn} onChange={(event) => setPublishedOn(event.target.value)} />
        </label>
        </fieldset>
        <fieldset className="contribution-fieldset">
          <legend>{t.privateEvidence}</legend>
          <p>{t.privateEvidenceNote}</p>
        </fieldset>
        <div className="contribution-actions">
          <button type="submit" className="button-primary" disabled={busy || !publicVersion}>
            {busy ? t.submitting : t.submit}
          </button>
        </div>
      </form>
    </section>
  );
}
