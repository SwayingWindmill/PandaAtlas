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
    new: "新建", assigned: "已分配", closed: "已关闭",
    confirmed: "已确认", provisional: "待证实",
  };
  return labels[value] ?? value;
}

export function reviewFieldLabel(fieldKey: string): string {
  const fields: Record<string, string> = {
    "profile.sex": "性别",
    "profile.birth_date": "出生日期",
    "profile.death_date": "死亡日期",
    "profile.name": "名称",
  };
  return fields[fieldKey] ?? fieldKey;
}

export function reviewDisplayValue(fieldKey: string, value: unknown): string {
  if (fieldKey === "profile.sex" && typeof value === "string") {
    return ({ male: "雄性", female: "雌性", unknown: "未知" } as Record<string, string>)[value] ?? value;
  }
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
