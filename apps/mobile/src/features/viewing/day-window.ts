import type { TimeWindow } from "@/features/institutions/institutions";

/** Minutes since midnight for "HH:MM". */
export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

/** "09:00–11:00" with an en dash, as Apple's schedules write a span. */
export function spanLabel(window: TimeWindow): string {
  return `${window.start}–${window.end}`;
}

/** The hours the strip spans: even hours around every window, at least 08:00–18:00. */
export function stripRange(windows: TimeWindow[]): { from: number; to: number } {
  const starts = windows.map((window) => minutesOf(window.start));
  const ends = windows.map((window) => minutesOf(window.end));
  const from = Math.min(8 * 60, ...starts.map((m) => Math.floor(m / 120) * 120));
  const to = Math.max(18 * 60, ...ends.map((m) => Math.ceil(m / 120) * 120));
  return { from, to };
}

/** A window's left offset and width as fractions of the strip. */
export function placeOnStrip(window: TimeWindow, range: { from: number; to: number }): { left: number; width: number } {
  const span = range.to - range.from;
  const start = Math.max(minutesOf(window.start), range.from);
  const end = Math.min(minutesOf(window.end), range.to);
  return { left: (start - range.from) / span, width: Math.max(0, end - start) / span };
}

/** 上午 or 下午 for a window, by when it starts. */
export function partOfDay(window: TimeWindow): string {
  return minutesOf(window.start) < 12 * 60 ? "上午" : "下午";
}

/** The day in order: each active window and the nap, earliest first. */
export function daySlots(viewing: { active: TimeWindow[]; nap: TimeWindow | null }): { kind: "active" | "nap"; window: TimeWindow }[] {
  return [
    ...viewing.active.map((window) => ({ kind: "active" as const, window })),
    ...(viewing.nap ? [{ kind: "nap" as const, window: viewing.nap }] : []),
  ].sort((a, b) => a.window.start.localeCompare(b.window.start));
}

/** "8–12 点" for whole hours, "8:30–11 点" otherwise: the hours as the 今天 card says them. */
export function hoursLabel(window: TimeWindow): string {
  const hour = (time: string) => {
    const [h, m] = time.split(":");
    return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
  };
  return `${hour(window.start)}–${hour(window.end)} 点`;
}
