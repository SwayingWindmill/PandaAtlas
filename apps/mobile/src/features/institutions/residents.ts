import type { PandaListItem } from "@/features/pandas/pandas";

export interface FormerResident {
  panda: PandaListItem;
  from: number | null;
  to: number | null;
  bornHere: boolean;
}

type Stay = { pandaId: string; startOn?: string; startPrecision?: string; endOn?: string };

const yearOf = (date: string | null | undefined) => (date ? Number(date.slice(0, 4)) : null);

const arrivedOnDayOfBirth = (stay: Stay, birthDate: string | null) =>
  birthDate !== null && stay.startPrecision === "day" && stay.startOn === birthDate;

export function residentsOf(stays: readonly Stay[], pandasById: ReadonlyMap<string, PandaListItem>) {
  const byPanda = new Map<string, Stay[]>();
  for (const stay of stays) {
    const own = byPanda.get(stay.pandaId);
    if (own) own.push(stay);
    else byPanda.set(stay.pandaId, [stay]);
  }
  const residents: PandaListItem[] = [];
  const former: FormerResident[] = [];
  let bornHere = 0;
  for (const [pandaId, own] of byPanda) {
    const panda = pandasById.get(pandaId);
    if (!panda) continue;
    const born = own.some((stay) => arrivedOnDayOfBirth(stay, panda.birthDate));
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
