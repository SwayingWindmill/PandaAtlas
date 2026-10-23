import type { PublicAtlasDataset } from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";
import type {
  PandaDetail,
  PublicEntityName,
  PublicFacilitySummary,
} from "@/lib/types";

export interface HomeV09Media {
  src: string;
  alt: string;
  credit: string | null;
  rights: string | null;
}

export interface HomeV09Panda {
  id: string;
  slug: string;
  name: string;
  alternateName: string | null;
  href: string;
  birthYear: string | null;
  placeLabel: string | null;
  media: HomeV09Media | null;
}

export interface HomeV09LeadStory {
  kind: "update" | "profile";
  label: string;
  title: string;
  deck: string;
  href: string;
  media: HomeV09Media | null;
  panda: HomeV09Panda;
  dateLabel: string | null;
}

export interface HomeV09TodayItem {
  kind: "update" | "family" | "place";
  label: string;
  title: string;
  body: string;
  href: string;
  dateLabel?: string | null;
}

export interface HomeV09Revision {
  id: string;
  panda: HomeV09Panda;
  summary: string;
  verifiedAt: string | null;
  dateLabel: string | null;
}

export interface HomeV09FamilyMember extends HomeV09Panda {
  relation: "parent" | "child";
}

export interface HomeV09FamilySpotlight {
  focus: HomeV09Panda;
  members: HomeV09FamilyMember[];
  title: string;
  body: string;
  href: string;
}

export interface HomeV09PlaceSpotlight {
  id: string;
  name: string;
  pandaCount: number;
  pandaIds: string[];
  href: string;
  media: HomeV09Media | null;
}

export interface HomeV09ViewModel {
  today: {
    lead: HomeV09LeadStory;
    secondary: HomeV09TodayItem[];
  };
  explore: {
    pandas: HomeV09Panda[];
    totalPublished: number;
  };
  revisions: HomeV09Revision[];
  family: HomeV09FamilySpotlight | null;
  places: HomeV09PlaceSpotlight[];
}

function localizedEntityName(names: PublicEntityName[], locale: PublicLocale): string | null {
  const preferred = locale === "zh" ? ["zh-Hans", "zh-CN", "zh"] : ["en", "en-US", "en-GB"];
  for (const language of preferred) {
    const item = names.find((name) => name.language === language);
    if (item?.value) return item.value;
  }
  return names[0]?.value ?? null;
}

function localizedRevisionSummary(panda: PandaDetail, locale: PublicLocale): string | null {
  const wanted = locale === "zh" ? "zh-CN" : "en";
  return panda.public_revision?.summaries.find((item) => item.locale === wanted)?.summary ?? null;
}

function localizedName(panda: PandaDetail, locale: PublicLocale) {
  const name = locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh;
  const alternate = locale === "zh" ? panda.name_en : panda.name_zh;
  return {
    name,
    alternateName: alternate && alternate !== name ? alternate : null,
  };
}

// Photos come from the panda covers read after the view model has picked its pandas.
export function mediaFor(fallbackAlt: string, asset: PandaDetail["media"][number], locale: PublicLocale): HomeV09Media | null {
  if (!asset.url) return null;
  return {
    src: asset.url,
    alt: (locale === "zh" ? asset.alt_zh ?? asset.alt_en : asset.alt_en ?? asset.alt_zh) ?? fallbackAlt,
    credit: asset.credit ?? asset.photographer ?? null,
    rights: asset.rights,
  };
}

function facilityName(
  facilityId: string | null | undefined,
  facilities: Map<string, PublicFacilitySummary>,
  locale: PublicLocale,
): string | null {
  if (!facilityId) return null;
  const facility = facilities.get(facilityId);
  return facility ? localizedEntityName(facility.names, locale) : null;
}

function publicPlaceLabel(
  panda: PandaDetail,
  facilities: Map<string, PublicFacilitySummary>,
  locale: PublicLocale,
): string | null {
  const label = facilityName(panda.current_place?.facility_id, facilities, locale)
    ?? panda.current_place?.coarse_location
    ?? panda.current_location
    ?? null;
  // Country-level coarse locations are only published in English.
  return label === "China" && locale === "zh" ? "中国" : label;
}

function toHomePanda(
  panda: PandaDetail,
  facilities: Map<string, PublicFacilitySummary>,
  locale: PublicLocale,
): HomeV09Panda {
  const names = localizedName(panda, locale);
  return {
    id: panda.id,
    slug: panda.slug,
    name: names.name,
    alternateName: names.alternateName,
    href: `/${locale}/pandas/${panda.slug}`,
    birthYear: panda.birth_date?.slice(0, 4) ?? null,
    placeLabel: publicPlaceLabel(panda, facilities, locale),
    media: null,
  };
}

function latestVerifiedAt(panda: PandaDetail): string | null {
  const values = [
    ...panda.sources.map((source) => source.last_verified_at),
    ...panda.conclusions.map((conclusion) => conclusion.last_verified_at),
    panda.current_place?.last_verified_at ?? null,
  ].filter((value): value is string => Boolean(value));
  return values.sort().at(-1) ?? null;
}

function formatDate(value: string | null, locale: PublicLocale): string | null {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

// Every published panda has photos, so photos do not rank pandas.
function profileRichness(panda: PandaDetail): number {
  return Number(Boolean(panda.public_revision?.summaries.length)) * 5
    + Number(Boolean(panda.father_id || panda.mother_id)) * 3
    + Math.min(panda.events.length, 4)
    + Math.min(panda.residencies.length, 4);
}

function decadeKey(panda: PandaDetail): string {
  const year = Number(panda.birth_date?.slice(0, 4));
  return Number.isFinite(year) ? String(Math.floor(year / 10) * 10) : "unknown";
}

function facilityKey(panda: PandaDetail): string {
  return panda.current_place?.facility_id
    ?? panda.residencies.at(-1)?.facility_id
    ?? panda.current_place?.coarse_location
    ?? panda.current_location
    ?? "unknown";
}

function diversifiedPandas(pandas: PandaDetail[], count: number): PandaDetail[] {
  const pool = [...pandas].sort((left, right) =>
    profileRichness(right) - profileRichness(left)
    || left.slug.localeCompare(right.slug)
  );
  const selected: PandaDetail[] = [];
  const facilityUse = new Map<string, number>();
  const decadeUse = new Map<string, number>();

  while (selected.length < count && pool.length) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < pool.length; index += 1) {
      const panda = pool[index];
      const fKey = facilityKey(panda);
      const dKey = decadeKey(panda);
      const score = profileRichness(panda)
        - (facilityUse.get(fKey) ?? 0) * 5
        - (decadeUse.get(dKey) ?? 0) * 3;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [next] = pool.splice(bestIndex, 1);
    selected.push(next);
    const fKey = facilityKey(next);
    const dKey = decadeKey(next);
    facilityUse.set(fKey, (facilityUse.get(fKey) ?? 0) + 1);
    decadeUse.set(dKey, (decadeUse.get(dKey) ?? 0) + 1);
  }

  return selected;
}

function buildRevisions(
  pandas: PandaDetail[],
  facilities: Map<string, PublicFacilitySummary>,
  locale: PublicLocale,
): HomeV09Revision[] {
  return pandas
    .flatMap((panda) => {
      const summary = localizedRevisionSummary(panda, locale);
      if (!summary) return [];
      const verifiedAt = latestVerifiedAt(panda);
      return [{
        id: panda.id,
        panda: toHomePanda(panda, facilities, locale),
        summary,
        verifiedAt,
        dateLabel: formatDate(verifiedAt, locale),
      }];
    })
    .sort((left, right) =>
      (right.verifiedAt ?? "").localeCompare(left.verifiedAt ?? "")
      || left.panda.slug.localeCompare(right.panda.slug)
    )
    .slice(0, 8);
}

function buildFamilySpotlight(
  pandas: PandaDetail[],
  facilities: Map<string, PublicFacilitySummary>,
  locale: PublicLocale,
): HomeV09FamilySpotlight | null {
  const byId = new Map(pandas.map((panda) => [panda.id, panda]));
  const childrenByParent = new Map<string, PandaDetail[]>();

  for (const panda of pandas) {
    for (const parentId of [panda.mother_id, panda.father_id]) {
      if (!parentId || !byId.has(parentId)) continue;
      childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), panda]);
    }
  }

  const ranked = pandas
    .map((panda) => {
      const parents = [panda.mother_id, panda.father_id]
        .flatMap((id) => id && byId.has(id) ? [byId.get(id) as PandaDetail] : []);
      const children = childrenByParent.get(panda.id) ?? [];
      return {
        panda,
        parents,
        children,
        score: (parents.length + children.length) * 10 + profileRichness(panda),
      };
    })
    .filter((item) => item.parents.length + item.children.length >= 2)
    .sort((left, right) => right.score - left.score || left.panda.slug.localeCompare(right.panda.slug));

  const candidate = ranked[0];
  if (!candidate) return null;

  const focus = toHomePanda(candidate.panda, facilities, locale);
  const members: HomeV09FamilyMember[] = [
    ...candidate.parents.map((panda) => ({
      ...toHomePanda(panda, facilities, locale),
      relation: "parent" as const,
    })),
    ...candidate.children.map((panda) => ({
      ...toHomePanda(panda, facilities, locale),
      relation: "child" as const,
    })),
  ].slice(0, 6);

  return {
    focus,
    members,
    title: locale === "zh"
      ? `${focus.name}的家族线索`
      : `The family around ${focus.name}`,
    body: locale === "zh"
      ? `从 ${members.length} 个公开亲缘连接继续认识这个家族。`
      : `Continue through ${members.length} published family connections.`,
    href: `/${locale}/families?view=lineage&focus=${candidate.panda.slug}`,
  };
}

function buildPlaces(
  pandas: PandaDetail[],
  facilities: PublicFacilitySummary[],
  locale: PublicLocale,
): HomeV09PlaceSpotlight[] {
  const pandasByFacility = new Map<string, Set<string>>();

  for (const panda of pandas) {
    const facilityIds = new Set([
      panda.current_place?.facility_id,
      ...panda.residencies.map((residency) => residency.facility_id),
    ].filter((id): id is string => Boolean(id)));

    for (const facilityId of facilityIds) {
      const pandaIds = pandasByFacility.get(facilityId) ?? new Set<string>();
      pandaIds.add(panda.id);
      pandasByFacility.set(facilityId, pandaIds);
    }
  }

  // Coarse locations ("China", free-text sites) are imprecise residency placeholders, not places to visit.
  return facilities
    .filter((facility) => facility.facility_type !== "coarse_location")
    .flatMap((facility) => {
      const pandaIds = [...(pandasByFacility.get(facility.id) ?? [])];
      const name = localizedEntityName(facility.names, locale);
      if (!name || pandaIds.length < 2) return [];
      return [{
        id: facility.id,
        name,
        pandaCount: pandaIds.length,
        pandaIds,
        href: `/${locale}/places/${facility.canonical_slug}`,
        media: null,
      }];
    })
    .sort((left, right) => right.pandaCount - left.pandaCount || left.name.localeCompare(right.name))
    .slice(0, 5);
}

export function buildHomeV09ViewModel(
  dataset: PublicAtlasDataset,
  locale: PublicLocale,
): HomeV09ViewModel {
  if (!dataset.pandas.length) {
    throw new Error("Home V0.9 requires at least one published panda.");
  }

  const facilities = new Map(dataset.facilities.map((facility) => [facility.id, facility]));
  const revisions = buildRevisions(dataset.pandas, facilities, locale);
  const family = buildFamilySpotlight(dataset.pandas, facilities, locale);
  const places = buildPlaces(dataset.pandas, dataset.facilities, locale);

  const leadPanda = revisions[0]?.panda
    ?? toHomePanda(
      [...dataset.pandas].sort((left, right) =>
        profileRichness(right) - profileRichness(left)
        || left.slug.localeCompare(right.slug)
      )[0],
      facilities,
      locale,
    );

  const leadRevision = revisions.find((revision) => revision.panda.id === leadPanda.id) ?? null;
  const leadSource = dataset.pandas.find((panda) => panda.id === leadPanda.id);
  if (!leadSource) {
    throw new Error("Home V0.9 lead panda is not present in the public dataset.");
  }

  const lead: HomeV09LeadStory = {
    kind: leadRevision ? "update" : "profile",
    label: leadRevision
      ? (locale === "zh" ? "最近更新" : "Recently updated")
      : (locale === "zh" ? "今日推荐" : "Featured today"),
    title: leadPanda.name,
    deck: leadRevision?.summary
      ?? leadSource.localized_content.find((item) => item.locale === (locale === "zh" ? "zh-CN" : "en"))?.summary
      ?? leadSource.intro
      ?? (locale === "zh" ? "看看它的资料、家人和生活过的地方。" : "See its profile, family, and the places it has lived."),
    href: leadPanda.href,
    media: leadPanda.media,
    panda: leadPanda,
    dateLabel: leadRevision?.dateLabel ?? null,
  };

  const secondary: HomeV09TodayItem[] = [];

  const nextRevision = revisions.find((revision) => revision.panda.id !== leadPanda.id);
  if (nextRevision) {
    secondary.push({
      kind: "update",
      label: locale === "zh" ? "最近补充" : "Recent addition",
      title: nextRevision.panda.name,
      body: nextRevision.summary,
      href: nextRevision.panda.href,
      dateLabel: nextRevision.dateLabel,
    });
  }

  if (family) {
    secondary.push({
      kind: "family",
      label: locale === "zh" ? "家族" : "Family",
      title: family.title,
      body: family.body,
      href: family.href,
    });
  }

  if (places[0]) {
    const place = places[0];
    secondary.push({
      kind: "place",
      label: locale === "zh" ? "地点" : "Place",
      title: place.name,
      body: locale === "zh"
        ? `连接 ${place.pandaCount} 只当前公开档案。`
        : `Connected to ${place.pandaCount} currently published profiles.`,
      href: place.href,
    });
  }

  return {
    today: {
      lead,
      secondary: secondary.slice(0, 3),
    },
    explore: {
      pandas: diversifiedPandas(dataset.pandas, 12).map((panda) => toHomePanda(panda, facilities, locale)),
      totalPublished: dataset.pandas.length,
    },
    revisions,
    family,
    places,
  };
}

export function homeV09PandaIds(model: HomeV09ViewModel): string[] {
  return [...new Set([
    model.today.lead.panda.id,
    ...model.explore.pandas.map((panda) => panda.id),
    ...model.revisions.map((revision) => revision.panda.id),
    ...(model.family ? [model.family.focus.id, ...model.family.members.map((member) => member.id)] : []),
    ...model.places.flatMap((place) => place.pandaIds.slice(0, 3)),
  ])];
}

export function withHomeV09Media(
  model: HomeV09ViewModel,
  covers: ReadonlyMap<string, PandaDetail["media"][number]>,
  locale: PublicLocale,
): HomeV09ViewModel {
  const withMedia = <T extends HomeV09Panda>(panda: T): T => {
    const asset = covers.get(panda.id);
    return asset ? { ...panda, media: mediaFor(panda.name, asset, locale) } : panda;
  };
  const leadPanda = withMedia(model.today.lead.panda);
  const placeMedia = (place: HomeV09PlaceSpotlight): HomeV09Media | null => {
    for (const pandaId of place.pandaIds.slice(0, 3)) {
      const asset = covers.get(pandaId);
      const media = asset ? mediaFor(place.name, asset, locale) : null;
      if (media) return media;
    }
    return null;
  };
  return {
    ...model,
    today: { ...model.today, lead: { ...model.today.lead, panda: leadPanda, media: leadPanda.media } },
    explore: { ...model.explore, pandas: model.explore.pandas.map(withMedia) },
    revisions: model.revisions.map((revision) => ({ ...revision, panda: withMedia(revision.panda) })),
    family: model.family
      ? { ...model.family, focus: withMedia(model.family.focus), members: model.family.members.map(withMedia) }
      : null,
    places: model.places.map((place) => ({ ...place, media: placeMedia(place) })),
  };
}
