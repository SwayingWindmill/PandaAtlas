import { queryOptions } from "@tanstack/react-query";
import type { components } from "@zhipanda/api-client";

import { localToday } from "@/features/engagement/seen";
import { type Family, familyOf } from "@/features/family/family";
import { loadInstitutionList } from "@/features/institutions/institutions";
import { memoryPlaces } from "@/features/on-this-day/load";
import { type Memory, memoriesOn } from "@/features/on-this-day/on-this-day";
import { shortPlace } from "@/features/pandas/areas";
import { currentPlaceId, loadPlaces, placeName } from "@/features/pandas/pandas";
import { type PlaceLived, type Stat, headlineStats, infobox, placesLived } from "@/features/pandas/profile-facts";
import { publicMediaUrl } from "@/lib/api";
import { type MilestoneKind, describeEvent } from "@/features/timeline/timeline";
import { displayName, englishName, pandaBirthDate, pandaFactStatus, pandaIsDeceased, pandaSex } from "@/lib/panda";
import { loadPandaDetail } from "@/lib/public-panda";

type Schemas = components["schemas"];
type LifeEvent = Schemas["PublicLifeEventSummaryDto"];
type Place = Schemas["PublicPlaceSummaryDto"];

export interface Profile {
  id: string;
  slug: string;
  name: string;
  /** The English name, when it differs from `name`: the second line of a 生日卡. */
  nameEn: string | null;
  /** YYYY-MM-DD (or a partial date), for the 生日卡. */
  birthDate: string | null;
  sex: "male" | "female" | null;
  deceased: boolean;
  /**
   * How sure the record is of the birth date and of 在世/离世. The page draws these as a check and a
   * hollow dot (DESIGN.md, The Structure Rule); the words go to VoiceOver only.
   */
  certainty: { birth: "confirmed" | "pending" | null; life: "confirmed" | "pending" | null };
  /** Cover first; empty when no photo is published. */
  photos: Photo[];
  facts: { label: string; value: string }[];
  /** Birthday, age and where it lives (or when it died): the stat tiles under the name. */
  stats: Stat[];
  /** The last move between two places it lived, said short: 华盛顿 → 卧龙, 2023. */
  move: { from: string; to: string; year: string } | null;
  /** Oldest first. */
  events: { id: string; kind: MilestoneKind; date: string; text: string; sourceIds: string[] }[];
  /**
   * What happened on this day in an earlier year, from its own dated and sourced records. Shown here even
   * for a panda that has died, as 纪念 (DECEASED_POLICY); 少显示 on 今天 does not reach its own page.
   */
  memories: Memory[];
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
  /** Who took it, without the archive: "Amaury Laporte". */
  creator: string | null;
  /** Where it was published, said short: the source's publisher, or the archive the credit names. */
  source: string | null;
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

/** 2023.11.08, or 2023.11 and 2023 when the record is only that precise. */
function eventDate(event: DatedEvent): string {
  const [year = event.occurredOn, month, day] = event.occurredOn.slice(0, 10).split("-");
  if (event.occurredPrecision === "year" || !month) return year;
  if (event.occurredPrecision === "month" || !day) return `${year}.${month}`;
  return `${year}.${month}.${day}`;
}

/**
 * A publisher as a seal or chip says it: the name before its long tail.
 * "Smithsonian National Zoo and Conservation Biology Institute" → "史密森",
 * "Wikimedia Commons contributors" → "Wikimedia", "China.org.cn / Xinhua" → "China.org.cn".
 */
export function shortPublisher(publisher: string): string {
  const short = publisher.split(/\s*\/|['’]s\b|\s+(?:National|Commons|and)\b/)[0]?.trim() || publisher;
  return CHINESE_NAMES[short] ?? short;
}

/** Publishers with a settled Chinese short name. */
const CHINESE_NAMES: Record<string, string> = { Smithsonian: "史密森" };

const MOVES = new Set(["transfer", "return", "arrival"]);

/**
 * The latest move from one facility to another, each said short. A move whose record names only the country
 * it went to takes the place of the stay that starts that day. Null when either end has no short name.
 */
function lastMove(
  completed: DatedEvent[],
  residencies: Schemas["PublicResidencySummaryDto"][],
  places: Map<string, Place>,
): Profile["move"] {
  const event = completed.filter((item) => MOVES.has(item.eventType) && item.fromPlaceId).at(-1);
  if (!event) return null;
  const from = shortPlace(places.get(event.fromPlaceId ?? ""));
  const arrivedAt = residencies.find((stay) => stay.startOn?.slice(0, 10) === event.occurredOn.slice(0, 10))?.placeId;
  const to = shortPlace(places.get(event.toPlaceId ?? "")) ?? shortPlace(places.get(arrivedAt ?? ""));
  if (!from || !to || from.short === to.short) return null;
  return { from: from.short, to: to.short, year: event.occurredOn.slice(0, 4) };
}

/** The panda's photos for viewing: cover first, then display order; evidence images are not photos of it. */
export function photosOf(
  media: Schemas["PublicMediaSummaryDto"][],
  evidence: Schemas["PublicEvidenceSummaryDto"][] = [],
): Photo[] {
  const publishers = new Map(evidence.map((source) => [source.sourceId, source.publisher]));
  const seen = new Set<string>();
  return [...media]
    .filter((item) => item.usageRole !== "evidence" && item.mediaType.startsWith("image/"))
    .sort((a, b) => Number(b.usageRole === "cover") - Number(a.usageRole === "cover") || a.displayOrder - b.displayOrder)
    .filter((item) => !seen.has(item.assetId) && Boolean(seen.add(item.assetId)))
    .map((item) => {
      const credit = [item.attributionText ?? item.creator, item.license].filter(Boolean).join("，");
      // "Amaury Laporte / Wikimedia Commons": the person, then the archive that published it.
      const [person, archive] = (item.creator ?? item.attributionText ?? "").split(/\s+\/\s+/);
      const publisher = (item.sourceId && publishers.get(item.sourceId)) || archive;
      return {
        id: item.assetId,
        url: publicMediaUrl(item.objectKey),
        credit: credit ? `照片 ${credit}` : null,
        creator: person?.trim() || null,
        source: publisher ? shortPublisher(publisher) : null,
      };
    });
}

export async function loadPhotos(slug: string): Promise<Photo[]> {
  const detail = await loadPandaDetail(slug);
  return photosOf(detail.media, detail.evidence);
}

export const photosQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["public", "photos", slug],
    queryFn: () => loadPhotos(slug),
    staleTime: 300_000,
    networkMode: "always",
  });

export const profileQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ["public", "profile", slug],
    queryFn: () => loadProfile(slug),
    staleTime: 60_000,
    networkMode: "always",
  });

export async function loadProfile(slug: string): Promise<Profile> {
  const [detail, places] = await Promise.all([loadPandaDetail(slug), loadPlaces()]);
  const { panda, residencies, events, media, evidence } = detail;
  const place = (id: string | undefined) => placeName(id ? places.get(id) : undefined);

  const sex = pandaSex(panda);
  const birthDate = pandaBirthDate(panda);
  const deceased = pandaIsDeceased(panda);
  const deathDate = panda.facts.find((fact) => fact.fieldKey === "death_date")?.value;
  const currentPlaceRecord = deceased ? undefined : places.get(currentPlaceId(residencies) ?? "");
  const currentPlace = placeName(currentPlaceRecord);
  const family = await familyOf(detail).catch(() => null);
  const completed = events
    .filter((event): event is DatedEvent => event.eventStatus === "completed" && Boolean(event.occurredOn))
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  // A birth event also names the mother; hers is not where she was born.
  const birth = events.find(
    (event) => event.eventStatus === "completed" && describeEvent(event, place, birthDate)?.kind === "birth",
  );
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
    nameEn: englishName(panda) === displayName(panda) ? null : englishName(panda),
    birthDate,
    sex,
    deceased,
    certainty: { birth: birthDate ? pandaFactStatus(panda, "birth_date") : null, life: pandaFactStatus(panda, "life_status") },
    photos: photosOf(media, evidence),
    facts,
    stats: headlineStats({
      birthDate,
      deceased,
      deathDate: typeof deathDate === "string" ? deathDate : null,
      place: shortPlace(currentPlaceRecord) ?? (currentPlace ? { short: currentPlace, sub: null } : null),
      today: localToday(),
    }),
    move: lastMove(completed, residencies, places),
    // Only what happened: an announced plan is not part of the panda's life yet.
    events: completed.flatMap((event) => {
      const told = describeEvent(event, place, birthDate);
      return told
        ? [{ id: event.eventId, kind: told.kind, date: eventDate(event), text: told.text, sourceIds: event.sourceIds }]
        : [];
    }),
    memories: memoriesOn({
      today: localToday(),
      pandas: [{ id: panda.pandaId, slug: panda.canonicalSlug, name: displayName(panda), birthDate, deceased }],
      events,
      residencies,
      places: memoryPlaces(places),
      pandaId: panda.pandaId,
      includeDeceased: true,
    }),
    family,
    placesLived: placesLived(residencies, (id) => place(id)),
    visit: await visitOf(currentPlaceRecord),
    sources: evidence
      .map(({ sourceId, publisher, title, url, lastVerifiedOn }) => ({ id: sourceId, publisher, title, url, lastVerifiedOn }))
      .sort((a, b) => b.lastVerifiedOn.localeCompare(a.lastVerifiedOn)),
  };
}
