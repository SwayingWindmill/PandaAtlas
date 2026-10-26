import type { components } from "@zhipanda/api-client";

// 纠错: a signed-in fan says what is wrong on a profile, what is right, and where that comes from. The API keeps
// it as a contribution for reviewers; the fan follows its status in 我的. Pure rules here, calls in submissions.ts.

type Submission = components["schemas"]["SubmitContributionDto"];
export type ContributionStatus = components["schemas"]["ContributionRecordDto"]["status"];

/** What a fan can point at, keyed as reviewers see it. */
export const TOPICS = [
  { fieldKey: "name", label: "名字" },
  { fieldKey: "sex", label: "性别" },
  { fieldKey: "birth_date", label: "出生日期" },
  { fieldKey: "current_location", label: "所在地" },
  { fieldKey: "parents", label: "家人" },
  { fieldKey: "other", label: "其他" },
] as const;

export type TopicKey = (typeof TOPICS)[number]["fieldKey"];

export const LIMITS = { value: 500, sourceTitle: 500, locator: 2000 } as const;

export interface CorrectionDraft {
  topic: TopicKey | null;
  value: string;
  sourceTitle: string;
  locator: string;
}

export const EMPTY_DRAFT: CorrectionDraft = { topic: null, value: "", sourceTitle: "", locator: "" };

/** The first thing missing, in form order, or null when the draft can be sent. */
export function draftProblem(draft: CorrectionDraft): string | null {
  if (!draft.topic) return "选一项哪里不对。";
  if (!draft.value.trim()) return "写下正确的内容。";
  if (!draft.sourceTitle.trim()) return "写下来源的名称。";
  if (!draft.locator.trim()) return "写下来源的链接或出处。";
  return null;
}

export function buildSubmission(
  draft: CorrectionDraft,
  target: { pandaId: string; releaseVersion: string },
  today: string,
): Submission {
  if (!draft.topic) throw new Error("A correction needs a topic");
  const locator = draft.locator.trim();
  // Keys only need to be unique within one submission, which has one assertion and one source.
  const sourceKey = "source-1";
  return {
    submissionType: "correction",
    targetPandaId: target.pandaId,
    publicVersionSeen: target.releaseVersion,
    assertions: [
      {
        assertionKey: "assertion-1",
        fieldKey: draft.topic,
        value: draft.value.trim(),
        // A fan's report, not a reviewed fact: reviewers confirm it.
        certainty: "provisional",
        lastVerifiedOn: today,
        sourceKeys: [sourceKey],
      },
    ],
    sources: [
      {
        sourceKey,
        sourceKind: /^https?:\/\/\S+$/i.test(locator) ? "url" : "other",
        title: draft.sourceTitle.trim(),
        locator,
      },
    ],
  };
}

const STATUS_LABEL: Record<ContributionStatus, string> = {
  submitted: "等待审核",
  accepted: "已采纳",
  not_accepted: "未采纳",
  duplicate: "已有人报告",
  out_of_scope: "不在收录范围",
};

export function statusLabel(status: ContributionStatus): string {
  return STATUS_LABEL[status];
}
