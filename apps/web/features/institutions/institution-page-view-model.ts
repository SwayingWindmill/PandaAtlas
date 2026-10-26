import type {
  PublicInstitutionRecord,
  V2Institution,
  V2InstitutionPlace,
} from "@/features/public-content/public-v2";
import type { PublicLocale } from "@/foundation/content/locales";
import type { PandaDetail } from "@/lib/types";

type LocalizedText = { zh?: string; en?: string } | undefined;
type VisitGuide = NonNullable<V2InstitutionPlace["visitGuide"]>;
export type VisitTipTopic = VisitGuide["tips"][number]["topic"];

export interface InstitutionPandaItem {
  id: string;
  slug: string;
  name: string;
  /** The name in the other language, when it differs. */
  alternateName: string | null;
  /** For example "雌性　2016 年出生". */
  detail: string;
  /** When the panda lived here, for example "2000 – 2023" or "2016 年至今". */
  stay: string;
  /** Sorts residents and the history list: the first day the panda lived here. */
  since: string;
}

export interface InstitutionFacilityItem {
  placeId: string;
  slug: string;
  name: string;
  basics: Array<{ key: "address" | "openingHours" | "admission" | "pandaArea"; value: string }>;
  tips: Array<{ topic: VisitTipTopic; text: string }>;
  verifiedOn: string | null;
  sourceUrls: string[];
}

export interface InstitutionPageViewModel {
  slug: string;
  name: string;
  alternateName: string | null;
  kind: NonNullable<V2Institution["profile"]>["kind"] | null;
  country: string | null;
  region: string | null;
  summary: string | null;
  websiteUrl: string | null;
  liveCamUrl: string | null;
  residents: InstitutionPandaItem[];
  formerResidents: InstitutionPandaItem[];
  facilities: InstitutionFacilityItem[];
  profileVerifiedOn: string | null;
  profileSourceUrls: string[];
}

/** Text in the page language, falling back to the other language rather than showing nothing. */
export function localizedText(value: LocalizedText, locale: PublicLocale): string | null {
  if (!value) return null;
  return (locale === "zh" ? value.zh ?? value.en : value.en ?? value.zh) ?? null;
}

function localizedPair(zh: string | undefined, en: string | undefined, locale: PublicLocale) {
  const display = (locale === "zh" ? zh ?? en : en ?? zh) ?? "";
  const alternate = (locale === "zh" ? en : zh) ?? null;
  return { display, alternate: alternate && alternate !== display ? alternate : null };
}

function countryName(code: string | undefined, locale: PublicLocale): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([locale === "zh" ? "zh-CN" : "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function year(date: string): string {
  return date.slice(0, 4);
}

function stayLabel(start: string, end: string | null, locale: PublicLocale): string {
  if (!end) return locale === "zh" ? `${year(start)} 年至今` : `Since ${year(start)}`;
  const from = year(start);
  const to = year(end);
  if (from === to) return locale === "zh" ? `${from} 年` : from;
  return `${from} – ${to}`;
}

function pandaDetail(panda: PandaDetail, locale: PublicLocale): string {
  const sex = {
    zh: { male: "雄性", female: "雌性", unknown: null },
    en: { male: "Male", female: "Female", unknown: null },
  }[locale][panda.gender];
  const born = panda.birth_date
    ? locale === "zh" ? `${year(panda.birth_date)} 年出生` : `Born ${year(panda.birth_date)}`
    : null;
  return [sex, born].filter(Boolean).join(listSeparator(locale));
}

/** Joins short facts on one line: a full-width space in Chinese, a comma in English; never a middle dot. */
export function listSeparator(locale: PublicLocale): string {
  return locale === "zh" ? "　" : ", ";
}

function facilityItem(place: V2InstitutionPlace, locale: PublicLocale): InstitutionFacilityItem {
  const guide = place.visitGuide;
  const basics = (["address", "openingHours", "admission", "pandaArea"] as const).flatMap((key) => {
    const value = localizedText(guide?.[key], locale);
    return value ? [{ key, value }] : [];
  });
  const tips = (guide?.tips ?? []).flatMap((tip) => {
    const text = localizedText(tip.text, locale);
    return text ? [{ topic: tip.topic, text }] : [];
  });
  return {
    placeId: place.placeId,
    slug: place.slug,
    name: localizedPair(place.nameZh, place.nameEn, locale).display || place.slug,
    basics,
    tips,
    verifiedOn: guide?.verifiedOn ?? null,
    sourceUrls: guide?.sourceUrls ?? [],
  };
}

export function buildInstitutionPageViewModel(
  record: PublicInstitutionRecord,
  locale: PublicLocale,
): InstitutionPageViewModel {
  const { institution, places, pandas } = record;
  const placeIds = new Set(places.map((place) => place.placeId));
  const here = (facilityId: string | null) => facilityId !== null && placeIds.has(facilityId);

  const residents: InstitutionPandaItem[] = [];
  const formerResidents: InstitutionPandaItem[] = [];
  for (const panda of pandas) {
    const stays = panda.residencies
      .filter((residency) => here(residency.facility_id))
      .sort((left, right) => left.start_date.localeCompare(right.start_date));
    const first = stays[0];
    if (!first) continue;
    const last = stays.at(-1) ?? first;
    const current = here(panda.current_place?.facility_id ?? null) && last.end_date === null;
    const name = localizedPair(panda.name_zh, panda.name_en ?? undefined, locale);
    const item: InstitutionPandaItem = {
      id: panda.id,
      slug: panda.slug,
      name: name.display || panda.slug,
      alternateName: name.alternate,
      detail: pandaDetail(panda, locale),
      stay: stayLabel(first.start_date, current ? null : last.end_date ?? last.start_date, locale),
      since: first.start_date,
    };
    (current ? residents : formerResidents).push(item);
  }
  residents.sort((left, right) => left.since.localeCompare(right.since));
  formerResidents.sort((left, right) => left.since.localeCompare(right.since));

  const name = localizedPair(institution.nameZh, institution.nameEn, locale);
  const regions = [...new Set(places.map((place) => place.region).filter((region): region is string => Boolean(region)))];
  return {
    slug: institution.slug,
    name: name.display || institution.slug,
    alternateName: name.alternate,
    kind: institution.profile?.kind ?? null,
    country: countryName(institution.countryCode, locale),
    region: regions.length === 1 ? regions[0] ?? null : null,
    summary: localizedText(institution.profile?.summary, locale),
    websiteUrl: institution.profile?.websiteUrl ?? null,
    liveCamUrl: institution.profile?.liveCamUrl ?? null,
    residents,
    formerResidents,
    facilities: places.map((place) => facilityItem(place, locale)),
    profileVerifiedOn: institution.profile?.verifiedOn ?? null,
    profileSourceUrls: institution.profile?.sourceUrls ?? [],
  };
}
