const eventNames: Record<string, string> = {
  "publication.release.activated": "已启用公开版本",
  "publication.release.rolled_back": "已回滚公开版本",
  "review.decision.recorded": "已记录审核决定",
};

const domainNames: Record<string, string> = {
  publication: "发布", review: "审核",
  identity: "工作人员", audit: "审计",
};

const objectNames: Record<string, string> = {
  public_release: "公开版本", review_case: "审核案件",
  account: "工作人员账号", panda: "熊猫档案",
};

export function auditEventName(eventType: string): string {
  return eventNames[eventType] ?? "未归类事件";
}

export function auditDomainName(sourceContext: string): string {
  return domainNames[sourceContext] ?? "其他来源";
}

export function auditObjectName(aggregateType: string): string {
  return objectNames[aggregateType] ?? "其他对象";
}
