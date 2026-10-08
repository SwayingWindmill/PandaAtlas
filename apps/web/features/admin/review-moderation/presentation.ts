export const ADMIN_QUEUE_PAGE_SIZE = 25;

export function formatQueueAge(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} 小时`;
  return `${Math.round(seconds / 86_400)} 天`;
}

export function hasAdminCapability(capabilities: readonly string[] | undefined, capability: string): boolean {
  return capabilities?.includes(capability) ?? false;
}

export function adminStateLabel(value: string): string {
  const labels: Record<string, string> = {
    new: "新建", open: "待处理", triage: "初步审核",
    assigned: "已分配", waiting: "等待补充资料",
    decision_ready: "待做决定", under_review: "处理中",
    in_review: "审核中",
    source_verification: "来源核验中", verification_pending: "待核验",
    incorporation_recommended: "已推荐策展", accepted: "已接受",
    not_accepted: "未接受", duplicate: "重复", out_of_scope: "超出范围",
    abuse: "滥用", closed: "已关闭", upheld: "维持决定",
    modified: "已调整", overturned: "已撤销", dismissed: "已驳回",
    normal: "正常", low: "低", medium: "中", high: "高", critical: "严重",
    confirmed: "已确认", tentative: "待证实", unknown: "未知",
    warning: "警告", submission_restricted: "禁止提交",
    attachment_restricted: "禁止附件", notification_restricted: "限制通知",
    account_suspended: "账号已暂停", account_closed_for_abuse: "违规关闭账号",
    verified: "已核验", rejected: "已驳回",
    policy_violation: "违反规则", repeat_abuse: "重复违规",
    review_complete: "审核完成",
  };
  return labels[value] ?? value;
}
