import type { PandaListItem } from "@/features/pandas/pandas";

/** A panda that lived here once: the years of its stay, and whether it was born here. */
export interface FormerResident {
  panda: PandaListItem;
  from: number | null;
  to: number | null;
  bornHere: boolean;
}

type Stay = { pandaId: string; startOn?: string; endOn?: string };

const yearOf = (date: string | null | undefined) => (date ? Number(date.slice(0, 4)) : null);

/**
 * Who lives at a venue and who lived there, from its residencies. A panda that moved between the
 * venue's facilities and is still here is a resident, not a former one. Former residents come
 * newest departure first, with the span of all their stays here.
 */
export function residentsOf(stays: readonly Stay[], pandasById: ReadonlyMap<string, PandaListItem>) {
  const byPanda = new Map<string, Stay[]>();
  for (const stay of stays) byPanda.set(stay.pandaId, [...(byPanda.get(stay.pandaId) ?? []), stay]);
  const residents: PandaListItem[] = [];
  const former: FormerResident[] = [];
  let bornHere = 0;
  for (const [pandaId, own] of byPanda) {
    const panda = pandasById.get(pandaId);
    if (!panda) continue;
    const born = panda.birthDate !== null && own.some((stay) => stay.startOn === panda.birthDate);
    if (born) bornHere += 1;
    if (own.some((stay) => !stay.endOn)) {
      residents.push(panda);
      continue;
    }
    const starts = own.map((stay) => yearOf(stay.startOn)).filter((year) => year !== null);
    const ends = own.map((stay) => yearOf(stay.endOn)).filter((year) => year !== null);
    former.push({
      panda,
      from: starts.length > 0 ? Math.min(...starts) : null,
      to: ends.length > 0 ? Math.max(...ends) : null,
      bornHere: born,
    });
  }
  former.sort((a, b) => (b.to ?? 0) - (a.to ?? 0));
  return { residents, former, bornHere };
}
