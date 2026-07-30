"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createDraft,
  getSubmission,
  prepareAttachment,
  runCommand,
  uploadAttachment,
} from "./api";
import { claimKindOptions, localeText, statusLabel } from "./copy";
import type {
  ClaimKind,
  CommandResult,
  Locale,
  StructuredAssertion,
  SubmissionType,
  SubmissionView,
  SubmittedSource,
} from "./types";

interface DraftAssertion {
  assertion_key: string;
  kind: ClaimKind;
  field_path: string;
  proposed_value: string;
  explanation: string;
  source_locators: string[];
  attachment_ids: string[];
}

interface ContributionEditorProps {
  locale: Locale;
  submissionId?: string;
}

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";

function newAssertion(): DraftAssertion {
  return {
    assertion_key: `claim-${crypto.randomUUID()}`,
    kind: "identity_name",
    field_path: "",
    proposed_value: "",
    explanation: "",
    source_locators: [],
    attachment_ids: [],
  };
}

function toDraftAssertion(assertion: StructuredAssertion): DraftAssertion {
  return {
    ...assertion,
    proposed_value:
      typeof assertion.proposed_value === "string"
        ? assertion.proposed_value
        : JSON.stringify(assertion.proposed_value ?? ""),
  };
}

function fieldExamples(kind: ClaimKind, locale: Locale): { path: string; value: string } {
  const examples: Record<ClaimKind, { path: string; zh: string; en: string }> = {
    identity_name: { path: "name_zh", zh: "例如：花花", en: "Example: Hua Hua" },
    vital_event: { path: "birth_date", zh: "例如：2020-07-04", en: "Example: 2020-07-04" },
    health: { path: "health.summary", zh: "说明健康事实", en: "Describe the health fact" },
    relationship: { path: "relationships.parent", zh: "填写稳定熊猫 ID", en: "Enter a stable panda ID" },
    residency_transfer: {
      path: "residency.current_facility_id",
      zh: "填写机构 ID 或转移日期",
      en: "Enter institution ID or transfer date",
    },
    institution: { path: "institution.name", zh: "填写机构信息", en: "Enter institution information" },
    source: { path: "sources.additional", zh: "说明新增来源", en: "Describe the additional source" },
    other: { path: "other", zh: "填写结构化值", en: "Enter a structured value" },
  };
  return { path: examples[kind].path, value: examples[kind][locale] };
}

function isEditable(status: SubmissionView["contributor_status"]): boolean {
  return status === "draft" || status === "action_required";
}

function latestAssertions(submission: SubmissionView): DraftAssertion[] {
  const revision = submission.revisions.at(-1);
  const source =
    submission.contributor_status === "draft"
      ? submission.draft_content.assertions
      : revision?.content.assertions;
  const assertions = source?.length ? source.map(toDraftAssertion) : [newAssertion()];
  const attachmentIds = submission.attachments.map((attachment) => attachment.attachment_id);
  return assertions.map((assertion, index) =>
    index === 0
      ? {
          ...assertion,
          attachment_ids: Array.from(new Set([...assertion.attachment_ids, ...attachmentIds])),
        }
      : assertion,
  );
}

function latestSources(submission: SubmissionView): SubmittedSource[] {
  if (submission.contributor_status === "draft" && submission.draft_content.sources?.length) {
    return submission.draft_content.sources;
  }
  const revision = submission.revisions.at(-1);
  return (
    revision?.sources.map((source) => ({
      source_kind: source.source_kind,
      title: source.title,
      locator: source.locator,
      publisher: source.publisher,
      published_on: source.published_on,
    })) ?? []
  );
}

export function ContributionEditor({ locale, submissionId }: ContributionEditorProps) {
  const [submission, setSubmission] = useState<SubmissionView | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [submissionType, setSubmissionType] = useState<SubmissionType>("correction");
  const [targetId, setTargetId] = useState("");
  const [publicVersion, setPublicVersion] = useState("");
  const [assertions, setAssertions] = useState<DraftAssertion[]>([newAssertion()]);
  const [sources, setSources] = useState<SubmittedSource[]>([
    { source_kind: "url", title: "", locator: "", publisher: "" },
  ]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const savingRef = useRef(false);

  const t = useCallback(
    (zh: string, en: string) => localeText(locale, zh, en),
    [locale],
  );

  const applySubmission = useCallback((next: SubmissionView, nextEtag: string | null) => {
    setSubmission(next);
    setEtag(nextEtag ?? `"submission:${next.submission_id}:v${next.version}"`);
    setSubmissionType(next.submission_type);
    setTargetId(next.target_id);
    setPublicVersion(next.public_version_seen);
    setAssertions(latestAssertions(next));
    const revisionSources = latestSources(next);
    setSources(
      revisionSources.length
        ? revisionSources
        : [{ source_kind: "url", title: "", locator: "", publisher: "" }],
    );
    setAdditionalContext(
      next.draft_content.additional_context ?? next.revisions.at(-1)?.content.additional_context ?? "",
    );
    setDirty(false);
  }, []);

  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    setBusy(true);
    void getSubmission(submissionId)
      .then(({ data, etag: responseEtag }) => {
        if (!cancelled) applySubmission(data, responseEtag);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t("加载失败", "Could not load submission"));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySubmission, submissionId, t]);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaveState("idle");
    setConfirmation(null);
  }, []);

  const draftPayload = useMemo(
    () => ({
      idempotency_key: `draft-save-${crypto.randomUUID()}`,
      expected_version: submission?.version ?? 1,
      locale,
      public_version_seen: publicVersion,
      assertions,
      sources,
      additional_context: additionalContext || null,
    }),
    [additionalContext, assertions, locale, publicVersion, sources, submission?.version],
  );

  const saveDraft = useCallback(async () => {
    if (!submission || !etag || submission.contributor_status !== "draft" || savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    setError(null);
    try {
      const result = await runCommand<CommandResult>(
        submission.submission_id,
        "save-draft",
        etag,
        draftPayload,
      );
      applySubmission(result.data.submission, result.etag);
      setSaveState("saved");
    } catch (reason) {
      setSaveState("idle");
      setError(reason instanceof Error ? reason.message : t("保存失败", "Save failed"));
    } finally {
      savingRef.current = false;
    }
  }, [applySubmission, draftPayload, etag, submission, t]);

  useEffect(() => {
    if (!dirty || submission?.contributor_status !== "draft") return;
    const timer = window.setTimeout(() => void saveDraft(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, saveDraft, submission?.contributor_status]);

  async function handleCreateDraft() {
    setBusy(true);
    setError(null);
    try {
      const result = await createDraft({
        idempotency_key: `draft-create-${crypto.randomUUID()}`,
        submission_type: submissionType,
        target_type: "panda",
        target_id: targetId.trim(),
        public_version_seen: publicVersion.trim(),
        locale,
        draft_content: {},
      });
      applySubmission(result.data.submission, result.etag);
      setConfirmation(t("草稿已创建，后续编辑会同步到服务器。", "Draft created. Further edits sync to the server."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("无法创建草稿", "Could not create draft"));
    } finally {
      setBusy(false);
    }
  }

  function updateAssertion(index: number, patch: Partial<DraftAssertion>) {
    setAssertions((current) =>
      current.map((assertion, itemIndex) =>
        itemIndex === index ? { ...assertion, ...patch } : assertion,
      ),
    );
    markDirty();
  }

  function updateSource(index: number, patch: Partial<SubmittedSource>) {
    setSources((current) =>
      current.map((source, itemIndex) => (itemIndex === index ? { ...source, ...patch } : source)),
    );
    markDirty();
  }

  async function handleUpload(file: File) {
    if (!submission || !etag) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(t("单个文件不能超过 10 MiB。", "Each file must be 10 MiB or smaller."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const reservation = await prepareAttachment(submission.submission_id, etag, {
        idempotency_key: `attachment-reserve-${crypto.randomUUID()}`,
        original_filename: file.name,
        media_type: file.type,
        byte_size: file.size,
      });
      await uploadAttachment(
        reservation.data.attachment.attachment_id,
        etag,
        reservation.data.upload_reference.reference,
        file,
      );
      const refreshed = await getSubmission(submission.submission_id);
      applySubmission(refreshed.data, refreshed.etag);
      setConfirmation(t("证据已进入隔离扫描队列。", "Evidence uploaded to the quarantine scan queue."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("上传失败", "Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  function buildFormalAssertions(): StructuredAssertion[] {
    const primaryLocator = sources
      .find((source) => source.title.trim() && source.locator.trim())
      ?.locator.trim();
    return assertions.map((assertion) => ({
      ...assertion,
      field_path: assertion.field_path.trim(),
      proposed_value: assertion.proposed_value.trim(),
      explanation: assertion.explanation.trim(),
      source_locators: assertion.source_locators.length
        ? assertion.source_locators
        : primaryLocator
          ? [primaryLocator]
          : [],
    }));
  }

  async function handleFormalSubmit() {
    if (!submission || !etag) return;
    const formalAssertions = buildFormalAssertions();
    if (
      !confirmed ||
      formalAssertions.some(
        (assertion) =>
          !assertion.field_path ||
          !assertion.proposed_value ||
          assertion.explanation.length < 10 ||
          (!assertion.source_locators.length && !assertion.attachment_ids.length),
      )
    ) {
      setError(
        t(
          "正式提交前，请完成字段、建议值、至少 10 个字符的解释、来源或附件，并勾选确认。",
          "Before submitting, complete each field, value, explanation of at least 10 characters, source or attachment, and confirmation.",
        ),
      );
      return;
    }
    const includedSources = sources.filter((source) => source.title.trim() && source.locator.trim());
    const responding = submission.contributor_status === "action_required";
    const currentRequest = responding ? submission.status_history.at(-1)?.status_event_id : undefined;
    setBusy(true);
    setError(null);
    try {
      const result = await runCommand<CommandResult>(
        submission.submission_id,
        responding ? "respond-information-request" : "submit",
        etag,
        {
          idempotency_key: `${responding ? "information-response" : "formal-submit"}-${crypto.randomUUID()}`,
          expected_version: submission.version,
          ...(currentRequest ? { request_status_event_id: currentRequest } : {}),
          locale,
          public_version_seen: publicVersion,
          assertions: formalAssertions,
          sources: includedSources,
          additional_context: additionalContext || null,
          confirmation: true,
        },
      );
      applySubmission(result.data.submission, result.etag);
      setConfirmation(
        responding
          ? t("补充信息已提交。", "Additional information submitted.")
          : t("提交成功。状态更新将出现在此页面。", "Submission received. Status updates will appear here."),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("提交失败", "Submission failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    if (!submission || !etag) return;
    const reason = window.prompt(t("请填写撤回原因", "Enter a withdrawal reason"));
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runCommand<CommandResult>(
        submission.submission_id,
        "withdraw",
        etag,
        {
          idempotency_key: `withdraw-${crypto.randomUUID()}`,
          expected_version: submission.version,
          locale,
          reason,
        },
      );
      applySubmission(result.data.submission, result.etag);
      setConfirmation(t("提交已撤回，历史修订仍会保留。", "Submission withdrawn; revision history is preserved."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("撤回失败", "Withdrawal failed"));
    } finally {
      setBusy(false);
    }
  }

  if (!submission) {
    return (
      <section className="contribution-panel" aria-labelledby="new-contribution-heading">
        <div className="contribution-panel__heading">
          <p className="eyebrow">{t("结构化贡献", "Structured contribution")}</p>
          <h1 id="new-contribution-heading">{t("提交更正或有来源的新信息", "Submit a correction or sourced information")}</h1>
          <p>{t("仅接受现有稳定熊猫目标。草稿可以不完整，正式提交会进行严格验证。", "Existing stable panda targets only. Drafts may be incomplete; formal submission is validated strictly.")}</p>
        </div>
        <div className="contribution-form-grid">
          <label>
            <span>{t("贡献类型", "Contribution type")}</span>
            <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as SubmissionType)}>
              <option value="correction">{t("更正现有信息", "Correct existing information")}</option>
              <option value="sourced_information">{t("补充有来源的信息", "Add sourced information")}</option>
            </select>
          </label>
          <label>
            <span>{t("稳定熊猫 ID", "Stable panda ID")}</span>
            <input value={targetId} onChange={(event) => setTargetId(event.target.value)} required inputMode="text" />
          </label>
          <label>
            <span>{t("你看到的公开版本", "Public version you saw")}</span>
            <input value={publicVersion} onChange={(event) => setPublicVersion(event.target.value)} required placeholder="2026.07.30" />
          </label>
        </div>
        {error ? <p className="contribution-message contribution-message--error" role="alert">{error}</p> : null}
        <div className="contribution-actions">
          <button type="button" onClick={handleCreateDraft} disabled={busy || !targetId.trim() || !publicVersion.trim()}>
            {busy ? t("正在创建…", "Creating…") : t("创建私有草稿", "Create private draft")}
          </button>
          <Link href={`/${locale}/me/submissions`}>{t("查看我的提交", "View my submissions")}</Link>
        </div>
      </section>
    );
  }

  const editable = isEditable(submission.contributor_status);
  return (
    <section className="contribution-panel" aria-labelledby="contribution-editor-heading">
      <header className="contribution-panel__heading">
        <div>
          <p className="eyebrow">{t("私有提交", "Private submission")}</p>
          <h1 id="contribution-editor-heading">{statusLabel(submission.contributor_status, locale)}</h1>
        </div>
        <div className="contribution-status-box" aria-live="polite">
          <strong>{saveState === "saving" ? t("正在保存…", "Saving…") : saveState === "saved" ? t("已同步", "Synced") : t("私有、不可索引", "Private and noindex")}</strong>
          <span>v{submission.version}</span>
        </div>
      </header>

      <dl className="contribution-summary">
        <div><dt>{t("目标", "Target")}</dt><dd>{submission.target_id}</dd></div>
        <div><dt>{t("公开版本", "Public version")}</dt><dd>{submission.public_version_seen}</dd></div>
        <div><dt>{t("修订", "Revisions")}</dt><dd>{submission.latest_revision_number}</dd></div>
      </dl>

      {submission.user_visible_reason ? (
        <aside className="contribution-message contribution-message--notice">
          <strong>{t("状态说明", "Status explanation")}</strong>
          <p>{submission.user_visible_reason}</p>
          {submission.status_history.at(-1)?.action_required_fields.length ? (
            <ul>{submission.status_history.at(-1)?.action_required_fields.map((field) => <li key={field}>{field}</li>)}</ul>
          ) : null}
        </aside>
      ) : null}

      {editable ? (
        <>
          <fieldset className="contribution-fieldset">
            <legend>{t("结构化断言", "Structured assertions")}</legend>
            {assertions.map((assertion, index) => {
              const examples = fieldExamples(assertion.kind, locale);
              return (
                <article className="contribution-claim" key={assertion.assertion_key}>
                  <div className="contribution-claim__heading">
                    <strong>{t(`断言 ${index + 1}`, `Assertion ${index + 1}`)}</strong>
                    {assertions.length > 1 ? <button type="button" className="button-link" onClick={() => { setAssertions((current) => current.filter((_, itemIndex) => itemIndex !== index)); markDirty(); }}>{t("移除", "Remove")}</button> : null}
                  </div>
                  <div className="contribution-form-grid">
                    <label><span>{t("类别", "Category")}</span><select value={assertion.kind} onChange={(event) => updateAssertion(index, { kind: event.target.value as ClaimKind })}>{claimKindOptions.map((option) => <option key={option.value} value={option.value}>{option[locale]}</option>)}</select></label>
                    <label><span>{t("字段路径", "Field path")}</span><input value={assertion.field_path} onChange={(event) => updateAssertion(index, { field_path: event.target.value })} placeholder={examples.path} /></label>
                    <label className="contribution-form-grid__wide"><span>{t("建议值", "Proposed value")}</span><input value={assertion.proposed_value} onChange={(event) => updateAssertion(index, { proposed_value: event.target.value })} placeholder={examples.value} /></label>
                    <label className="contribution-form-grid__wide"><span>{t("来源如何支持该断言", "How the evidence supports this assertion")}</span><textarea value={assertion.explanation} onChange={(event) => updateAssertion(index, { explanation: event.target.value })} rows={4} /></label>
                  </div>
                </article>
              );
            })}
            <button type="button" className="button-secondary" onClick={() => { setAssertions((current) => [...current, newAssertion()]); markDirty(); }}>{t("添加断言", "Add assertion")}</button>
          </fieldset>

          <fieldset className="contribution-fieldset">
            <legend>{t("来源", "Sources")}</legend>
            {sources.map((source, index) => (
              <div className="contribution-form-grid contribution-source" key={index}>
                <label><span>{t("来源类型", "Source type")}</span><select value={source.source_kind} onChange={(event) => updateSource(index, { source_kind: event.target.value as SubmittedSource["source_kind"] })}><option value="url">URL</option><option value="publication">{t("出版物", "Publication")}</option><option value="document">{t("文件", "Document")}</option><option value="other">{t("其他", "Other")}</option></select></label>
                <label><span>{t("标题", "Title")}</span><input value={source.title} onChange={(event) => updateSource(index, { title: event.target.value })} /></label>
                <label className="contribution-form-grid__wide"><span>{t("链接、DOI 或定位信息", "URL, DOI, or locator")}</span><input value={source.locator} onChange={(event) => { updateSource(index, { locator: event.target.value }); setAssertions((current) => current.map((item) => ({ ...item, source_locators: event.target.value.trim() ? [event.target.value.trim()] : [] }))); }} /></label>
                <label><span>{t("发布方", "Publisher")}</span><input value={source.publisher ?? ""} onChange={(event) => updateSource(index, { publisher: event.target.value })} /></label>
              </div>
            ))}
          </fieldset>

          <fieldset className="contribution-fieldset">
            <legend>{t("私有证据", "Private evidence")}</legend>
            <p>{t("支持 PDF、JPEG、PNG、WebP；每个最多 10 MiB，共最多 5 个、30 MiB。上传后先进入隔离扫描。", "PDF, JPEG, PNG, and WebP; 10 MiB each, five files and 30 MiB total. Uploads enter quarantine scanning first.")}</p>
            <label className="contribution-upload"><span>{t("选择文件", "Choose evidence file")}</span><input type="file" accept={ACCEPTED_FILE_TYPES} disabled={busy || submission.attachments.length >= 5} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUpload(file); event.currentTarget.value = ""; }} /></label>
            <ul className="contribution-attachment-list">{submission.attachments.map((attachment) => <li key={attachment.attachment_id}><span>{attachment.original_filename}</span><strong>{attachment.state}</strong><small>{Math.ceil(attachment.byte_size / 1024)} KiB</small></li>)}</ul>
          </fieldset>

          <label className="contribution-context"><span>{t("补充说明（草稿可为空）", "Additional context (optional in draft)")}</span><textarea rows={5} value={additionalContext} onChange={(event) => { setAdditionalContext(event.target.value); markDirty(); }} /></label>

          <label className="contribution-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{t("我确认这些断言和来源准确表达了我要提交的内容。", "I confirm these assertions and sources accurately represent my contribution.")}</span></label>

          {error ? <p className="contribution-message contribution-message--error" role="alert">{error}</p> : null}
          {confirmation ? <p className="contribution-message contribution-message--success" role="status">{confirmation}</p> : null}
          <div className="contribution-actions">
            {submission.contributor_status === "draft" ? <button type="button" className="button-secondary" onClick={() => void saveDraft()} disabled={busy || saveState === "saving"}>{t("保存草稿", "Save draft")}</button> : null}
            <button type="button" onClick={() => void handleFormalSubmit()} disabled={busy}>{submission.contributor_status === "action_required" ? t("提交补充信息", "Submit additional information") : t("正式提交", "Submit formally")}</button>
            <button type="button" className="button-danger" onClick={() => void handleWithdraw()} disabled={busy}>{t("撤回", "Withdraw")}</button>
          </div>
        </>
      ) : null}

      <section className="contribution-history" aria-labelledby="status-history-heading">
        <h2 id="status-history-heading">{t("状态记录", "Status history")}</h2>
        <ol className="contribution-timeline">
          {submission.status_history.map((event) => (
            <li key={event.status_event_id}>
              <div>
                <strong>{statusLabel(event.status, locale)}</strong>
                <time dateTime={event.occurred_at}>
                  {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(event.occurred_at))}
                </time>
              </div>
              {event.user_visible_reason ? <p>{event.user_visible_reason}</p> : null}
              {event.target_redirect_id ? (
                <p>{t("新目标：", "New target: ")}{event.target_redirect_id}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="contribution-history" aria-labelledby="revision-history-heading">
        <h2 id="revision-history-heading">{t("不可变修订", "Immutable revisions")}</h2>
        {submission.revisions.length ? (
          <div className="contribution-revisions">
            {submission.revisions.map((revision) => (
              <details key={revision.revision_number}>
                <summary>
                  {t(`修订 ${revision.revision_number}`, `Revision ${revision.revision_number}`)} · {revision.public_version_seen}
                </summary>
                <ul>
                  {(revision.content.assertions ?? []).map((assertion) => (
                    <li key={assertion.assertion_key}>
                      <strong>{assertion.field_path}</strong>
                      <span>{String(assertion.proposed_value)}</span>
                      <p>{assertion.explanation}</p>
                    </li>
                  ))}
                </ul>
                {revision.sources.length ? (
                  <ul className="contribution-source-list">
                    {revision.sources.map((source) => (
                      <li key={source.source_id}>
                        <strong>{source.title}</strong>
                        <span>{source.locator}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ))}
          </div>
        ) : (
          <p>{t("尚未正式提交修订。", "No formal revision has been submitted yet.")}</p>
        )}
      </section>

      {submission.assertion_results.length ? (
        <section className="contribution-history" aria-labelledby="assertion-results-heading">
          <h2 id="assertion-results-heading">{t("逐断言结果", "Per-assertion results")}</h2>
          <ul className="contribution-result-list">
            {submission.assertion_results.map((result) => (
              <li key={`${result.created_at}-${result.assertion_key}`}>
                <strong>{result.assertion_key}</strong>
                <span>{result.disposition}</span>
                {result.explanation ? <p>{result.explanation}</p> : null}
                {result.public_reference_id ? <small>{result.public_reference_id}</small> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!editable && ["submitted", "accepted"].includes(submission.contributor_status) ? (
        <div className="contribution-actions">
          <button type="button" className="button-danger" onClick={() => void handleWithdraw()} disabled={busy}>
            {t("撤回", "Withdraw")}
          </button>
        </div>
      ) : null}
      <div className="contribution-actions">
        <Link href={`/${locale}/me/submissions`}>{t("返回我的提交", "Back to my submissions")}</Link>
      </div>
    </section>
  );
}
