import type { ClaimKind, ContributorStatus, Locale } from "./types";

export const claimKindOptions: Array<{ value: ClaimKind; zh: string; en: string }> = [
  { value: "identity_name", zh: "身份与名称", en: "Identity and name" },
  { value: "vital_event", zh: "出生、死亡与生命事件", en: "Birth, death, and vital events" },
  { value: "health", zh: "健康信息", en: "Health information" },
  { value: "relationship", zh: "亲缘与关系", en: "Relationships and lineage" },
  { value: "residency_transfer", zh: "居住地与转移", en: "Residency and transfer" },
  { value: "institution", zh: "机构信息", en: "Institution information" },
  { value: "source", zh: "来源补充", en: "Source information" },
  { value: "other", zh: "其他结构化信息", en: "Other structured information" },
];

const statusCopy: Record<ContributorStatus, { zh: string; en: string }> = {
  draft: { zh: "草稿", en: "Draft" },
  submitted: { zh: "已提交", en: "Submitted" },
  action_required: { zh: "需要补充信息", en: "Action required" },
  duplicate: { zh: "重复提交", en: "Duplicate" },
  out_of_scope: { zh: "不在受理范围", en: "Out of scope" },
  not_accepted: { zh: "未采纳", en: "Not accepted" },
  accepted: { zh: "已接受", en: "Accepted" },
  incorporation_in_progress: { zh: "正在纳入档案", en: "Incorporation in progress" },
  incorporated_full: { zh: "已全部纳入", en: "Fully incorporated" },
  incorporated_partial: { zh: "已部分纳入", en: "Partially incorporated" },
  withdrawn: { zh: "已撤回", en: "Withdrawn" },
  expired: { zh: "草稿已过期", en: "Draft expired" },
  target_merged: { zh: "目标已合并", en: "Target merged" },
  target_unpublished: { zh: "目标已下架", en: "Target unpublished" },
};

export function statusLabel(status: ContributorStatus, locale: Locale): string {
  return statusCopy[status][locale];
}

export function localeText(locale: Locale, zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}
