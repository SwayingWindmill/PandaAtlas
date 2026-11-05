/**
 * Official birthday events, curated by hand. Only add an entry that links an
 * institution's own announcement: `url` must be that page, `source` its
 * publisher, `date` the event day (YYYY-MM-DD) and `checkedOn` when it was read.
 * Intentionally empty — no seed data.
 */
export type BirthdayEvent = {
  pandaSlug: string;
  title: string;
  url: string;
  source: string;
  date: string;
  checkedOn: string;
};

export const BIRTHDAY_EVENTS: readonly BirthdayEvent[] = [];

export function eventsFor(slug: string, events: readonly BirthdayEvent[] = BIRTHDAY_EVENTS) {
  return events.filter((e) => e.pandaSlug === slug && /^https:\/\//.test(e.url));
}
