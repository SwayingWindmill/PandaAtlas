import type { PublicFormerResidentSummary, PublicPandaSummary } from "./public-read.application.js";

export interface InstitutionStayRecord {
  pandaId: string;
  startOn?: string;
  startPrecision?: string;
  endOn?: string;
}

export interface InstitutionResidentsSummary {
  residents: PublicPandaSummary[];
  former: PublicFormerResidentSummary[];
  bornHereCount: number;
}

function birthDateOf(panda: PublicPandaSummary): string | null {
  for (const fieldKey of ["birth_date", "identity.birth_date"]) {
    const value = panda.facts.find((fact) => fact.fieldKey === fieldKey)?.value;
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function yearOf(date: string | undefined): number | null {
  if (!date || date.length < 4) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function arrivedOnDayOfBirth(stay: InstitutionStayRecord, birthDate: string | null): boolean {
  return birthDate !== null && stay.startPrecision === "day" && stay.startOn === birthDate;
}

/** Splits an institution's stays into current residents, former stays, and local births. */
export function buildInstitutionResidents(
  stays: readonly InstitutionStayRecord[],
  pandasById: ReadonlyMap<string, PublicPandaSummary>,
): InstitutionResidentsSummary {
  const byPanda = new Map<string, InstitutionStayRecord[]>();
  for (const stay of stays) {
    const own = byPanda.get(stay.pandaId);
    if (own) own.push(stay);
    else byPanda.set(stay.pandaId, [stay]);
  }

  const residents: PublicPandaSummary[] = [];
  const former: PublicFormerResidentSummary[] = [];
  let bornHereCount = 0;

  for (const [pandaId, own] of byPanda) {
    const panda = pandasById.get(pandaId);
    if (panda === undefined) continue;
    const birthDate = birthDateOf(panda);
    const bornHere = own.some((stay) => arrivedOnDayOfBirth(stay, birthDate));
    if (bornHere) bornHereCount += 1;
    if (own.some((stay) => !stay.endOn)) {
      residents.push(panda);
      continue;
    }
    const starts = own.map((stay) => yearOf(stay.startOn)).filter((year): year is number => year !== null);
    const ends = own.map((stay) => yearOf(stay.endOn)).filter((year): year is number => year !== null);
    former.push({
      panda,
      ...(starts.length > 0 ? { fromYear: Math.min(...starts) } : {}),
      ...(ends.length > 0 ? { toYear: Math.max(...ends) } : {}),
      bornHere,
    });
  }

  residents.sort((a, b) => a.canonicalSlug.localeCompare(b.canonicalSlug));
  former.sort((a, b) => (b.toYear ?? 0) - (a.toYear ?? 0) || a.panda.canonicalSlug.localeCompare(b.panda.canonicalSlug));
  return { residents, former, bornHereCount };
}
