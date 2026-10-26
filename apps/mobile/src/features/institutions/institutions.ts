import type { components } from "@zhipanda/api-client";

import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { api } from "@/lib/api";

type Schemas = components["schemas"];
type Institution = Schemas["PublicInstitutionSummaryDto"];
type Place = Schemas["PublicPlaceSummaryDto"];
type Tip = Schemas["FacilityVisitTipDto"];

const KIND: Record<NonNullable<Institution["profile"]>["kind"], string> = {
  zoo: "动物园",
  breeding_center: "繁育研究基地",
  wildlife_park: "野生动物园",
};

const COUNTRY: Record<string, string> = { CN: "中国", US: "美国", JP: "日本", KR: "韩国", GB: "英国", DE: "德国", FR: "法国" };

const TIP: Record<Tip["topic"], string> = {
  best_time: "什么时候去",
  finding_pandas: "怎么找到熊猫",
  getting_there: "怎么去",
  good_to_know: "提示",
};

export interface InstitutionListItem {
  slug: string;
  name: string;
  meta: string;
  domestic: boolean;
}

export interface Facility {
  id: string;
  name: string;
  /** Opening hours, tickets, panda area and address, in the order a visitor checks them. */
  guide: { label: string; value: string }[];
  tips: { label: string; text: string }[];
  coordinates: { latitude: number; longitude: number } | null;
}

export interface InstitutionDetail {
  slug: string;
  name: string;
  meta: string;
  summary: string | null;
  liveCamUrl: string | null;
  websiteUrl: string | null;
  verifiedOn: string | null;
  sources: string[];
  facilities: Facility[];
  residents: PandaListItem[];
  former: PandaListItem[];
}

const nameOf = (institution: Institution) => institution.nameZh ?? institution.nameEn ?? institution.slug;

function metaOf(institution: Institution): string {
  const kind = institution.profile ? KIND[institution.profile.kind] : null;
  const country = institution.countryCode ? (COUNTRY[institution.countryCode] ?? null) : null;
  return [kind, country].filter(Boolean).join("　");
}

let list: Promise<Institution[]> | null = null;

/** Every published institution, loaded once per app session. Empty until a release carries them. */
export function loadInstitutionList(): Promise<Institution[]> {
  list ??= api
    .GET("/api/v2/institutions")
    .then(({ data }) => {
      if (!data) throw new Error("Institutions unavailable");
      return data.items;
    })
    .catch((error: unknown) => {
      list = null;
      throw error;
    });
  return list;
}

export async function loadInstitutions(): Promise<InstitutionListItem[]> {
  const institutions = await loadInstitutionList();
  return institutions.map((institution) => ({
    slug: institution.slug,
    name: nameOf(institution),
    meta: metaOf(institution),
    domestic: institution.countryCode === "CN",
  }));
}

function facilityOf(place: Place): Facility {
  const guide = place.visitGuide;
  const rows: [string, Schemas["LocalizedTextDto"] | undefined][] = [
    ["开放时间", guide?.openingHours],
    ["门票", guide?.admission],
    ["熊猫馆", guide?.pandaArea],
    ["地址", guide?.address],
  ];
  return {
    id: place.placeId,
    name: place.nameZh ?? place.nameEn ?? place.slug,
    guide: rows.flatMap(([label, text]) => (text?.zh ? [{ label, value: text.zh }] : [])),
    tips: (guide?.tips ?? []).flatMap((tip) => (tip.text.zh ? [{ label: TIP[tip.topic], text: tip.text.zh }] : [])),
    coordinates:
      place.latitude !== undefined && place.longitude !== undefined ? { latitude: place.latitude, longitude: place.longitude } : null,
  };
}

export async function loadInstitution(slug: string): Promise<InstitutionDetail> {
  const [detail, residencies, pandas] = await Promise.all([
    api.GET("/api/v2/institutions/{slug}", { params: { path: { slug } } }),
    api.GET("/api/v2/residencies"),
    loadPandaIndex(),
  ]);
  if (!detail.data || !residencies.data) throw new Error(`Institution ${slug} unavailable`);
  const { institution, places } = detail.data;
  const placeIds = new Set(places.map((place) => place.placeId));
  const pandasById = new Map(pandas.map((panda) => [panda.id, panda]));
  const here = residencies.data.items.filter((residency) => placeIds.has(residency.placeId));
  const pandasOf = (current: boolean) => [
    ...new Set(here.filter((residency) => !residency.endOn === current).flatMap((residency) => pandasById.get(residency.pandaId) ?? [])),
  ];
  const residents = pandasOf(true);
  const profile = institution.profile;

  return {
    slug: institution.slug,
    name: nameOf(institution),
    meta: metaOf(institution),
    summary: profile?.summary?.zh ?? null,
    liveCamUrl: profile?.liveCamUrl ?? null,
    websiteUrl: profile?.websiteUrl ?? null,
    verifiedOn: profile?.verifiedOn ?? null,
    sources: profile?.sourceUrls ?? [],
    facilities: places.map(facilityOf),
    residents,
    // A panda that moved between this institution's facilities is a resident, not a former one.
    former: pandasOf(false).filter((panda) => !residents.includes(panda)),
  };
}

/** "https://www.panda.org.cn/about" → "panda.org.cn", for naming a source in one line. */
export function hostname(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? url;
}
