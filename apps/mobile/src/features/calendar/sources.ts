import { loadPandaIndex } from "@/features/pandas/pandas";
import { api } from "@/lib/api";

import type { CalendarEvent, CalendarPanda } from "./calendar";

let events: Promise<CalendarEvent[]> | null = null;

/** The published pandas and life events every month is built from, loaded once per app session. */
export async function loadCalendarSources(): Promise<{
  pandas: CalendarPanda[];
  events: CalendarEvent[];
}> {
  events ??= api
    .GET("/api/v2/life-events")
    .then(({ data }) => {
      if (!data) throw new Error("Life events unavailable");
      return data.items;
    })
    .catch((error: unknown) => {
      events = null;
      throw error;
    });
  const [pandas, lifeEvents] = await Promise.all([loadPandaIndex(), events]);
  return { pandas, events: lifeEvents };
}
