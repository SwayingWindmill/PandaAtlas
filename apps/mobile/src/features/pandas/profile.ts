import type { components } from "@zhipanda/api-client";

import { type Family, familyOf } from "@/features/family/family";
import { loadInstitutionList } from "@/features/institutions/institutions";
import { currentPlaceId, loadPlaces, placeName } from "@/features/pandas/pandas";
import { api, publicMediaUrl } from "@/lib/api";
import { displayName, pandaBirthDate, pandaIsDeceased, pandaSex } from "@/lib/panda";

type Schemas = components["schemas"];
type LifeEvent = Schemas["PublicLifeEventSummaryDto"];
type Place = Schemas["PublicPlaceSummaryDto"];

export interface Profile {
  id: string;
  slug: string;
  name: string;
  photo: { url: string; credit: string | null } | null;
  facts: { label: string; value: string }[];
  events: { id: string; date: string; text: string }[];
  /** Null when the lineage could not be loaded; the rest of the profile still shows. */
  family: Family | null;
  /** Where to see the panda now, when its facility belongs to a published institution. */
  visit: { place: string; address: string | null; institutionSlug: string } | null;
}

async function visitOf(place: Place | undefined): Promise<Profile["visit"]> {
  if (!place?.institutionId) return null;
  const institutions = await loadInstitutionList().catch(() => []);
  const institution = institutions.find((item) => item.institutionId === place.institutionId);
  const name = placeName(place);
  if (!institution || !name) return null;
  return { place: name, address: place.visitGuide?.address?.zh ?? null, institutionSlug: institution.slug };
}

/** "2020-07-20" → "2020 年 7 月 20 日"; month and year precision stay as precise as the record. */
export function longDate(value: string): string {
  const [year, month, day] = value.split("-");
  return [`${year} 年`, month && `${Number(month)} 月`, day && `${Number(day)} 日`].filter(Boolean).join(" ");
}

type DatedEvent = LifeEvent & { occurredOn: string };

function shortDate(event: DatedEvent): string {
  const [year, month] = event.occurredOn.split("-");
  return event.occurredPrecision === "year" || !month ? year : `${year}.${Number(month)}`;
}

function eventText(event: LifeEvent, place: (id: string | undefined) => string | null): string | null {
  const to = place(event.toPlaceId);
  switch (event.eventType) {
    case "birth":
      return to ? `在${to}出生` : "出生";
    case "arrival":
      return to ? `抵达${to}` : "抵达";
    case "transfer":
      return to ? `搬到${to}` : "迁居";
    case "return":
      return to ? `回国，住进${to}` : "回国";
    case "public_debut":
      return to ? `在${to}首次亮相` : "首次亮相";
    case "naming":
      return "命名";
    case "death":
      return "离世";
    default:
      return null;
  }
}

function coverPhoto(media: Schemas["PublicMediaSummaryDto"][]): Profile["photo"] {
  const cover = [...media].sort(
    (a, b) => Number(b.usageRole === "cover") - Number(a.usageRole === "cover") || a.displayOrder - b.displayOrder,
  )[0];
  if (!cover) return null;
  const author = cover.attributionText ?? cover.creator;
  const credit = [author, cover.license].filter(Boolean).join("，");
  return { url: publicMediaUrl(cover.objectKey), credit: credit ? `照片 ${credit}` : null };
}

export async function loadProfile(slug: string): Promise<Profile> {
  const [detail, places] = await Promise.all([api.GET("/api/v2/pandas/{slug}", { params: { path: { slug } } }), loadPlaces()]);
  if (!detail.data) throw new Error(`Panda ${slug} unavailable`);
  const { panda, residencies, events, media } = detail.data;
  const place = (id: string | undefined) => placeName(id ? places.get(id) : undefined);

  const sex = pandaSex(panda);
  const birthDate = pandaBirthDate(panda);
  const deceased = pandaIsDeceased(panda);
  const deathDate = panda.facts.find((fact) => fact.fieldKey === "death_date")?.value;
  const currentPlaceRecord = deceased ? undefined : places.get(currentPlaceId(residencies) ?? "");
  const currentPlace = placeName(currentPlaceRecord);
  const facts = [
    sex && { label: "性别", value: sex === "female" ? "雌" : "雄" },
    birthDate && { label: "出生", value: longDate(birthDate) },
    currentPlace && { label: "所在地", value: currentPlace },
    deceased && { label: "离世", value: typeof deathDate === "string" ? longDate(deathDate) : "已离世" },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));

  return {
    id: panda.pandaId,
    slug: panda.canonicalSlug,
    name: displayName(panda),
    photo: coverPhoto(media),
    facts,
    // Only what happened: an announced plan is not part of the panda's life yet.
    events: events
      .filter((event): event is DatedEvent => event.eventStatus === "completed" && Boolean(event.occurredOn))
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
      .flatMap((event) => {
        const text = eventText(event, place);
        return text ? [{ id: event.eventId, date: shortDate(event), text }] : [];
      }),
    family: await familyOf(detail.data).catch(() => null),
    visit: await visitOf(currentPlaceRecord),
  };
}
