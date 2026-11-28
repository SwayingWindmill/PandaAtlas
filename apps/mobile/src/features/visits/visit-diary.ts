import type { SeenEntry } from "@/features/engagement/seen";
import type { PandaListItem } from "@/features/pandas/pandas";
import type { Visit } from "@/features/visits/visits";

export interface YearVisitGroup {
  year: string;
  visits: Visit[];
}

/**
 * Matches pandas marked `见过` on the same calendar day as a visit and at the same place.
 * Falls back to the panda's current `placeId` only for legacy seen entries lacking `placeId`.
 */
export function matchSeenPandasForVisit(
  visit: Pick<Visit, "placeId" | "visitedOn">,
  seenEntries: readonly SeenEntry[],
  pandaIndexById: ReadonlyMap<string, PandaListItem>,
): PandaListItem[] {
  const seenIds = new Set<string>();
  const matched: PandaListItem[] = [];
  for (const entry of seenEntries) {
    if (!entry.seenOn || entry.seenOn !== visit.visitedOn) continue;
    if (seenIds.has(entry.pandaId)) continue;
    const panda = pandaIndexById.get(entry.pandaId);
    if (!panda) continue;
    const matchesPlace = entry.placeId === visit.placeId || (!entry.placeId && panda.placeId === visit.placeId);
    if (!matchesPlace) continue;
    seenIds.add(entry.pandaId);
    matched.push(panda);
  }
  return matched;
}

/** Groups visits by year (newest year first, newest visit first inside each year). */
export function groupVisitsByYear(visits: readonly Visit[]): YearVisitGroup[] {
  const sorted = [...visits].sort(
    (a, b) => b.visitedOn.localeCompare(a.visitedOn) || b.createdAt.localeCompare(a.createdAt),
  );
  const groups = new Map<string, Visit[]>();
  for (const visit of sorted) {
    const year = visit.visitedOn.slice(0, 4);
    const current = groups.get(year);
    if (current) current.push(visit);
    else groups.set(year, [visit]);
  }
  return [...groups.entries()]
    .map(([year, items]) => ({ year, visits: items }))
    .sort((a, b) => b.year.localeCompare(a.year));
}
