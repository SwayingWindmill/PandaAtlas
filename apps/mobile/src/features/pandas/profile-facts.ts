// What a profile states at the top, as the canvas infobox and the design system order it: sex, birth, where it was
// born, where it lives (or when it died and at what age), parents. A missing core fact reads 暂无记录 rather than
// disappearing, so a fan can see what is unknown and report it.

export const UNKNOWN = "暂无记录";

export interface Fact {
  label: string;
  value: string;
}

export interface PlaceLived {
  place: string;
  /** "2016–2024", "2024 至今", or "" when the record has no dates. */
  years: string;
  current: boolean;
}

export interface Residency {
  placeId: string;
  startOn?: string;
  endOn?: string;
}

/** Full years between two dates, or the difference of their years when either is only a year. */
export function ageAt(birthDate: string, endDate: string): number {
  const years = Number(endDate.slice(0, 4)) - Number(birthDate.slice(0, 4));
  if (birthDate.length < 10 || endDate.length < 10) return years;
  return endDate.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

/** "2016–2024", "2024 至今", "2020" for a stay within one year, or "" without dates. */
function yearsOf(residency: Residency): string {
  const start = residency.startOn?.slice(0, 4);
  const end = residency.endOn?.slice(0, 4);
  if (!start) return end ? `至 ${end}` : "";
  if (!end) return `${start} 至今`;
  return end === start ? start : `${start}–${end}`;
}

/** Every place it has lived, newest first; the open stay is the current one. */
export function placesLived(residencies: Residency[], placeName: (placeId: string) => string | null): PlaceLived[] {
  return [...residencies]
    .sort((a, b) => (b.startOn ?? "").localeCompare(a.startOn ?? ""))
    .flatMap((residency) => {
      const place = placeName(residency.placeId);
      if (!place) return [];
      return [{ place, years: yearsOf(residency), current: !residency.endOn }];
    });
}

export function infobox(input: {
  sex: "male" | "female" | null;
  birthDate: string | null;
  birthPlace: string | null;
  deceased: boolean;
  deathDate: string | null;
  currentPlace: string | null;
  parents: string[];
  longDate: (value: string) => string;
}): Fact[] {
  const facts: Fact[] = [
    { label: "性别", value: input.sex === "female" ? "雌" : input.sex === "male" ? "雄" : UNKNOWN },
    { label: "出生", value: input.birthDate ? input.longDate(input.birthDate) : UNKNOWN },
  ];
  if (input.birthPlace) facts.push({ label: "出生地", value: input.birthPlace });
  if (input.deceased) {
    facts.push({ label: "离世", value: input.deathDate ? input.longDate(input.deathDate) : "已离世" });
    if (input.birthDate && input.deathDate)
      facts.push({ label: "享年", value: `${ageAt(input.birthDate, input.deathDate)} 岁` });
  } else {
    facts.push({ label: "所在地", value: input.currentPlace ?? UNKNOWN });
  }
  facts.push({ label: "父母", value: input.parents.length > 0 ? input.parents.join("　") : UNKNOWN });
  return facts;
}
