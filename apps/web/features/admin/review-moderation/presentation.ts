export const ADMIN_QUEUE_PAGE_SIZE = 25;

export function formatQueueAge(seconds: number): string {
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

export function hasAdminCapability(capabilities: readonly string[] | undefined, capability: string): boolean {
  return capabilities?.includes(capability) ?? false;
}

export function adminStateLabel(value: string): string {
  return value.replaceAll("_", " ");
}
