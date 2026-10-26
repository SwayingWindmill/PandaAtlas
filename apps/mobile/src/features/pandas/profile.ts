import type { components } from "@zhipanda/api-client";

import { type Family, familyOf } from "@/features/family/family";
import { loadInstitutionList } from "@/features/institutions/institutions";
import { currentPlaceId, loadPlaces, placeName } from "@/features/pandas/pandas";
import { type PlaceLived, infobox, placesLived } from "@/features/pandas/profile-facts";
import { api, publicMediaUrl } from "@/lib/api";
import { displayName, pandaBirthDate, pandaIsDeceased, pandaSex } from "@/lib/panda";

type Schemas = components["schemas"];
type LifeEvent = Schemas["PublicLifeEventSummaryDto"];
type Place = Schemas["PublicPlaceSummaryDto"];

export interface Profile {
  id: string;
  slug: string;
  name: string;
  deceased: boolean;
  /** Cover first; empty when no photo is published. */
  photos: Photo[];
  facts: { label: string; value: string }[];
  events: { id: string; date: string; text: string }[];
  /** Null when the lineage could not be loaded; the rest of the profile still shows. */
  family: Family | null;
  /** Every place it has lived, newest first. */
  placesLived: PlaceLived[];
  /** Where to see the panda now, when its facility belongs to a published institution. */
  visit: { place: string; address: string | null; institutionSlug: string } | null;
  sources: Source[];
}

export interface Photo {
  id: string;
  url: string;
  /** "照片 王小明 / CC BY 4.0，CC-BY-4.0". */
  credit: string | null;
}

export interface Source {
  id: string;
  publisher: string;
  title: string;
  url: string;
  lastVerifiedOn: string;
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
  const [year = event.occurredOn, month] = event.occurredOn.split("-");
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

/** The panda's photos for viewing: cover first, then display order; evidence images are not photos of it. */
export function photosOf(media: Schemas["PublicMediaSummaryDto"][]): Photo[] {
  const seen = new Set<string>();
  return [...media]
    .filter((item) => item.usageRole !== "evidence" && item.mediaType.startsWith("image/"))
    .sort((a, b) => Number(b.usageRole === "cover") - Number(a.usageRole === "cover") || a.displayOrder - b.displayOrder)
    .filter((item) => !seen.has(item.assetId) && Boolean(seen.add(item.assetId)))
    .map((item) => {
      const credit = [item.attributionText ?? item.creator, item.license].filter(Boolean).join("，");
      return { id: item.assetId, url: publicMediaUrl(item.objectKey), credit: credit ? `照片 ${credit}` : null };
    });
}

export async function loadPhotos(slug: string): Promise<Photo[]> {
  const detail = await api.GET("/api/v2/pandas/{slug}", { params: { path: { slug } } });
  if (!detail.data) throw new Error(`Panda ${slug} unavailable`);
  return photosOf(detail.data.media);
}

export async function loadProfile(slug: string): Promise<Profile> {
  const [detail, places] = await Promise.all([api.GET("/api/v2/pandas/{slug}", { params: { path: { slug } } }), loadPlaces()]);
  if (!detail.data) throw new Error(`Panda ${slug} unavailable`);
  const { panda, residencies, events, media, evidence } = detail.data;
  const place = (id: string | undefined) => placeName(id ? places.get(id) : undefined);

  const sex = pandaSex(panda);
  const birthDate = pandaBirthDate(panda);
  const deceased = pandaIsDeceased(panda);
  const deathDate = panda.facts.find((fact) => fact.fieldKey === "death_date")?.value;
  const currentPlaceRecord = deceased ? undefined : places.get(currentPlaceId(residencies) ?? "");
  const currentPlace = placeName(currentPlaceRecord);
  const family = await familyOf(detail.data).catch(() => null);
  const birth = events.find((event) => event.eventType === "birth" && event.eventStatus === "completed");
  const facts = infobox({
    sex,
    birthDate,
    birthPlace: place(birth?.toPlaceId),
    deceased,
    deathDate: typeof deathDate === "string" ? deathDate : null,
    currentPlace,
    parents: [family?.father?.name, family?.mother?.name].filter((name): name is string => Boolean(name)),
    longDate,
  });

  return {
    id: panda.pandaId,
    slug: panda.canonicalSlug,
    name: displayName(panda),
    deceased,
    photos: photosOf(media),
    facts,
    // Only what happened: an announced plan is not part of the panda's life yet.
    events: events
      .filter((event): event is DatedEvent => event.eventStatus === "completed" && Boolean(event.occurredOn))
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
      .flatMap((event) => {
        const text = eventText(event, place);
        return text ? [{ id: event.eventId, date: shortDate(event), text }] : [];
      }),
    family,
    placesLived: placesLived(residencies, (id) => place(id)),
    visit: await visitOf(currentPlaceRecord),
    sources: evidence
      .map(({ sourceId, publisher, title, url, lastVerifiedOn }) => ({ id: sourceId, publisher, title, url, lastVerifiedOn }))
      .sort((a, b) => b.lastVerifiedOn.localeCompare(a.lastVerifiedOn)),
  };
}
