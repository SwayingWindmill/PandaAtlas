export function isCommunityIntakeUiEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_COMMUNITY_INTAKE_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}
