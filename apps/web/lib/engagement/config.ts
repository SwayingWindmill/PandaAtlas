export function isEngagementUiEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_ENGAGEMENT_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}
