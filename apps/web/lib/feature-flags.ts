function isEnvFlagEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export function isEngagementUiEnabled(): boolean {
  return isEnvFlagEnabled(process.env.NEXT_PUBLIC_ENGAGEMENT_ENABLED);
}

export function isCommunityIntakeUiEnabled(): boolean {
  return isEnvFlagEnabled(process.env.NEXT_PUBLIC_COMMUNITY_INTAKE_ENABLED);
}

export function isFeedUiEnabled(): boolean {
  return isEnvFlagEnabled(process.env.NEXT_PUBLIC_FEED_ENABLED);
}

export function isNotificationCenterEnabled(): boolean {
  return isEnvFlagEnabled(process.env.NEXT_PUBLIC_NOTIFICATION_ENABLED);
}
