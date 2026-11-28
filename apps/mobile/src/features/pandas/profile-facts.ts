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

/** What a stat block shows when the record is silent; short enough to fit a third of the row. */
export const NOT_RECORDED = "未记录";

export interface Stat {
  key: "birth" | "age" | "place";
  label: string;
  /** The big figure: "8.21", "6", "卧龙". */
  value: string;
  /** A small unit after the figure: "岁", "个月", "年". */
  unit?: string;
  /** Said in place of the label under the figure: the base inside an area ("神树坪基地"). */
  detail?: string;
}

/** Whole months between two full dates. */
function monthsBetween(start: string, end: string): number {
  const months = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7));
  return end.slice(8, 10) < start.slice(8, 10) ? months - 1 : months;
}

function ageParts(birthDate: string, endDate: string): { value: string; unit: string } {
  const years = ageAt(birthDate, endDate);
  if (years >= 1 || birthDate.length < 10 || endDate.length < 10) return { value: String(Math.max(years, 0)), unit: "岁" };
  return { value: String(Math.max(monthsBetween(birthDate, endDate), 0)), unit: "个月" };
}

/** "2020-08-21" → "8.21"; a month-only date → "8 月"; a year-only one → the year. */
function birthday(birthDate: string): Pick<Stat, "value" | "unit"> {
  const [year = birthDate, month, day] = birthDate.split("-");
  if (month && day) return { value: `${Number(month)}.${Number(day)}` };
  if (month) return { value: String(Number(month)), unit: "月" };
  return { value: year, unit: "年" };
}

/**
 * The three figures at the top of a profile, as Health and Fitness lead with their summary tiles:
 * birthday, age (享年 once it has died) and where it lives (the year it died once it has).
 */
export function headlineStats(input: {
  birthDate: string | null;
  deceased: boolean;
  deathDate: string | null;
  /** The short name of where it lives ("卧龙") and the base inside that area ("神树坪基地"). */
  place: { short: string; sub: string | null } | null;
  today: string;
}): Stat[] {
  const birth: Stat = { key: "birth", label: "生日", ...(input.birthDate ? birthday(input.birthDate) : { value: NOT_RECORDED }) };
  if (input.deceased) {
    return [
      birth,
      {
        key: "age",
        label: "享年",
        ...(input.birthDate && input.deathDate ? ageParts(input.birthDate, input.deathDate) : { value: NOT_RECORDED }),
      },
      {
        key: "place",
        label: "离世",
        ...(input.deathDate ? { value: input.deathDate.slice(0, 4), unit: "年" } : { value: "已离世" }),
      },
    ];
  }
  return [
    birth,
    { key: "age", label: "年龄", ...(input.birthDate ? ageParts(input.birthDate, input.today) : { value: NOT_RECORDED }) },
    {
      key: "place",
      label: "所在地",
      value: input.place?.short ?? NOT_RECORDED,
      ...(input.place?.sub ? { detail: input.place.sub } : {}),
    },
  ];
}

export const QUIET_DASH = "—";

export interface UnifiedMetric {
  key: "birth" | "place" | "studbook";
  label: string;
  value: string;
  sub: string | null;
  /** Quiet dash state when unrecorded: never painted bright blue. */
  muted: boolean;
  /** True when the column navigates to an institution or glossary screen. */
  link: boolean;
  spoken: string;
}

function birthMetricParts(birthDate: string, deceased: boolean, today: string): { value: string; sub: string } {
  const [year = birthDate, month, day] = birthDate.split("-");
  const age = ageParts(birthDate, today);
  const ageLabel = `${age.value} ${age.unit}`;
  if (month && day) {
    const value = `${Number(month)}月${Number(day)}日`;
    return { value, sub: deceased ? `${year} 年生` : `${year} 年　${ageLabel}` };
  }
  if (month) {
    return { value: `${Number(month)}月`, sub: deceased ? `${year} 年生` : `${year} 年　${ageLabel}` };
  }
  return { value: `${year} 年`, sub: deceased ? "出生年份" : ageLabel };
}

/**
 * The v3.7 borderless 3-column metric strip (`生日 | 现居 | 谱系号` for living pandas; `生日 | 离世 | 谱系号`
 * when deceased). Unrecorded cells render a quiet muted dash rather than a bright action link.
 */
export function unifiedMetrics(input: {
  birthDate: string | null;
  birthConfirmed: boolean;
  deceased: boolean;
  deathDate: string | null;
  place: { short: string; sub: string | null } | null;
  hasInstitution: boolean;
  studbookNumber: string | null;
  today: string;
}): [UnifiedMetric, UnifiedMetric, UnifiedMetric] {
  const birth = (() => {
    if (!input.birthDate) {
      return {
        key: "birth" as const,
        label: "生日",
        value: QUIET_DASH,
        sub: "暂未收录",
        muted: true,
        link: false,
        spoken: "生日，未记录",
      };
    }
    const { value, sub } = birthMetricParts(input.birthDate, input.deceased, input.today);
    return {
      key: "birth" as const,
      label: "生日",
      value,
      sub,
      muted: false,
      link: false,
      spoken: `生日，${value}，${sub.replace(/　/g, " ")}${input.birthConfirmed ? "，已确认" : ""}`,
    };
  })();

  const middle = (() => {
    if (input.deceased) {
      const value = input.deathDate ? `${input.deathDate.slice(0, 4)} 年` : "已离世";
      const sub = input.birthDate && input.deathDate ? `享年 ${ageAt(input.birthDate, input.deathDate)} 岁` : null;
      return {
        key: "place" as const,
        label: "离世",
        value,
        sub,
        muted: false,
        link: false,
        spoken: `离世，${value}${sub ? `，${sub}` : ""}`,
      };
    }
    if (!input.place) {
      return {
        key: "place" as const,
        label: "现居",
        value: QUIET_DASH,
        sub: "暂未收录",
        muted: true,
        link: false,
        spoken: "现居，未记录",
      };
    }
    return {
      key: "place" as const,
      label: "现居",
      value: input.place.short,
      sub: input.place.sub ?? "常驻地",
      muted: false,
      link: input.hasInstitution,
      spoken: `现居，${input.place.short}${input.place.sub ? `，${input.place.sub}` : ""}`,
    };
  })();

  const studbook = input.studbookNumber
    ? {
        key: "studbook" as const,
        label: "谱系号",
        value: input.studbookNumber,
        sub: "国际谱系",
        muted: false,
        link: true,
        spoken: `谱系号，${input.studbookNumber}，国际谱系`,
      }
    : {
        key: "studbook" as const,
        label: "谱系号",
        value: QUIET_DASH,
        sub: "国际谱系",
        muted: true,
        link: false,
        spoken: "谱系号，未记录",
      };

  return [birth, middle, studbook];
}
