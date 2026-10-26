import { loadPandaIndex } from "@/features/pandas/pandas";
import { loadLifeEvents } from "@/lib/public-data";

import type { CalendarEvent, CalendarPanda } from "./calendar";

/** The published pandas and life events every month is built from. */
export async function loadCalendarSources(): Promise<{ pandas: CalendarPanda[]; events: CalendarEvent[] }> {
  const [pandas, events] = await Promise.all([loadPandaIndex(), loadLifeEvents()]);
  return { pandas, events };
}
