const capabilityDomains: Record<string, string> = {
  account: "个人资料", admin: "后台", audit: "审计", curation: "策展", identity: "工作人员",
  moderation: "内容治理", publication: "发布", review: "审核", privacy: "隐私",
};

const capabilityDescriptions: Record<string, string> = {
  "review.case.read": "查看审核案件", "review.case.claim": "领取审核案件", "review.case.decide": "处理审核案件",
  "audit.read": "查看审计记录", "audit.export": "导出审计记录", "identity.staff.read": "查看工作人员",
  "identity.role.manage": "管理岗位授权", "identity.account.manage": "管理工作人员账号",
  "curation.change.read": "查看策展变更", "curation.change.manage": "核验策展变更",
  "curation.change.approve": "独立审批策展变更", "publication.release.manage": "管理候选发布版本",
  "publication.release.activate": "启用与回滚公开版本", "publication.emergency": "紧急管理公开内容",
};

export function capabilityDescription(capability: string): string {
  return capabilityDescriptions[capability] ?? "其他授权（详情见权限代码）";
}

export function capabilityGroups(capabilities: readonly string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const capability of capabilities) {
    const domain = capabilityDomains[capability.split(".")[0] ?? ""] ?? "其他权限";
    groups.set(domain, [...(groups.get(domain) ?? []), capability]);
  }
  return [...groups.entries()];
}
