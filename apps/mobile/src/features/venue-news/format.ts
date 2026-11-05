export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The updated-at day in Asia/Shanghai, where every institution's notice is dated. */
export function updatedDay(instant: string): string {
  const t = Date.parse(instant);
  if (Number.isNaN(t)) return instant.slice(0, 10);
  return new Date(t + 8 * 3600_000).toISOString().slice(0, 10);
}

/** "2026.11.06", as the timeline dates a notice. */
export function dotDate(day: string): string {
  return day.slice(0, 10).replaceAll("-", ".");
}

/** Days from today in Asia/Shanghai to the day: 2 for the day after tomorrow, negative once past. */
export function daysUntil(day: string, now = new Date()): number {
  const today = updatedDay(now.toISOString());
  return Math.round((Date.parse(`${day.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
