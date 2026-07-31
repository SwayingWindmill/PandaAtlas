export function isNotificationCenterEnabled(): boolean {
  return process.env.NEXT_PUBLIC_NOTIFICATION_ENABLED === "true";
}
