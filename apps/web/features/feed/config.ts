export function isFeedUiEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_FEED_ENABLED?.trim().toLowerCase();
  return value === "true" || value === "1";
}
