import { WORLD_HEIGHT, WORLD_WIDTH, clusterWorldPoints, projectToWorld } from "@zhipanda/world-map";

// Same country names as the institution list. An unknown code stays unnamed rather than showing the code.
const COUNTRY: Record<string, string> = {
  CN: "中国",
  US: "美国",
  JP: "日本",
  KR: "韩国",
  GB: "英国",
  DE: "德国",
  FR: "法国",
};

export interface MapInstitutionInput {
  institutionId: string;
  slug: string;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
}

export interface MapPlaceInput {
  placeId: string;
  institutionId?: string;
  slug: string;
  placeType: string;
  nameZh?: string;
  nameEn?: string;
  countryCode?: string;
  region?: string;
  longitude?: number;
  latitude?: number;
}

export interface MapResidencyInput {
  pandaId: string;
  placeId: string;
  startOn?: string;
  endOn?: string;
}

export interface MapPandaInput {
  id: string;
  slug: string;
  name: string;
}

export interface MapItem {
  id: string;
  kind: "institution" | "place";
  slug: string;
  name: string;
  where: string | null;
  overseas: boolean;
  residentCount: number;
  residentNames: string | null;
  residents: MapPandaInput[];
  point: { x: number; y: number } | null;
}

export interface MapCluster {
  id: string;
  /** Position as a percentage of the outline, for a dot laid over the SVG. */
  left: number;
  top: number;
  residentCount: number;
  items: MapItem[];
}

export interface MapGroup {
  id: "china" | "overseas";
  title: string;
  items: MapItem[];
}

export interface MapView {
  items: MapItem[];
  clusters: MapCluster[];
  groups: MapGroup[];
}

export interface PlacePage {
  name: string;
  where: string | null;
  institution: { slug: string; name: string } | null;
  residents: MapPandaInput[];
}

function countryLabel(code: string | undefined): string | null {
  if (!code) return null;
  return COUNTRY[code] ?? null;
}

function displayName(nameZh: string | undefined, nameEn: string | undefined, slug: string): string {
  return nameZh ?? nameEn ?? slug;
}

export function pandaCountLabel(count: number): string {
  return count ? `${count} 只熊猫` : "现在没有熊猫";
}

/** Spoken name of a row or a single-place dot. */
export function mapItemLabel(item: MapItem): string {
  const where = item.overseas && item.where ? `${item.where}，` : "";
  return `${item.name}，${where}${pandaCountLabel(item.residentCount)}`;
}

/** Spoken name of a dot. Several places on one dot are named together. */
export function mapDotLabel(cluster: MapCluster): string {
  const only = cluster.items.length === 1 ? cluster.items[0] : undefined;
  if (only) return mapItemLabel(only);
  return `${cluster.items.map((item) => item.name).join("、")}，${cluster.items.length} 个地方`;
}

function residentNames(residents: MapPandaInput[]): string | null {
  const names = residents.map((panda) => panda.name);
  if (!names.length) return null;
  const shown = names.slice(0, 3);
  const more = names.length - shown.length;
  return more ? `${shown.join("、")} 等 ${names.length} 只` : shown.join("、");
}

function pointsOf(places: MapPlaceInput[]): { longitude: number; latitude: number }[] {
  return places.flatMap((place) =>
    typeof place.longitude === "number" && typeof place.latitude === "number"
      ? [{ longitude: place.longitude, latitude: place.latitude }]
      : [],
  );
}

/** Pandas living at these places now, oldest stay first. A panda counted once. */
function residentsAt(
  placeIds: ReadonlySet<string>,
  residencies: readonly MapResidencyInput[],
  pandasById: ReadonlyMap<string, MapPandaInput>,
): MapPandaInput[] {
  const since = new Map<string, string>();
  for (const residency of residencies) {
    if (residency.endOn || !placeIds.has(residency.placeId)) continue;
    const start = residency.startOn ?? "";
    const current = since.get(residency.pandaId);
    if (current === undefined || start < current) since.set(residency.pandaId, start);
  }
  return [...since.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]))
    .flatMap(([id]) => {
      const panda = pandasById.get(id);
      return panda ? [panda] : [];
    });
}

function toItem(
  kind: MapItem["kind"],
  id: string,
  slug: string,
  name: string,
  countryCode: string | null,
  places: MapPlaceInput[],
  residencies: readonly MapResidencyInput[],
  pandasById: ReadonlyMap<string, MapPandaInput>,
): MapItem {
  const residents = residentsAt(new Set(places.map((place) => place.placeId)), residencies, pandasById);
  const first = pointsOf(places)[0];
  return {
    id: `${kind}:${id}`,
    kind,
    slug,
    name,
    where: countryLabel(countryCode ?? undefined),
    overseas: countryCode !== null && countryCode !== "CN",
    residentCount: residents.length,
    residentNames: residentNames(residents),
    residents,
    point: first ? projectToWorld(first.longitude, first.latitude) : null,
  };
}

/**
 * Institutions, plus places that belong to none. Coarse locations are left out: they mark a country
 * or region a record could not narrow down. A place without coordinates stays in the list and gets no dot.
 */
export function buildMapView(
  institutions: readonly MapInstitutionInput[],
  places: readonly MapPlaceInput[],
  residencies: readonly MapResidencyInput[],
  pandas: readonly MapPandaInput[],
): MapView {
  const mappable = places.filter((place) => place.placeType !== "coarse_location");
  const pandasById = new Map(pandas.map((panda) => [panda.id, panda]));
  const knownInstitutions = new Set(institutions.map((institution) => institution.institutionId));
  const items = institutions.map((institution) => {
    const own = mappable.filter((place) => place.institutionId === institution.institutionId);
    const countryCode = institution.countryCode ?? own[0]?.countryCode ?? null;
    return toItem(
      "institution",
      institution.institutionId,
      institution.slug,
      displayName(institution.nameZh, institution.nameEn, institution.slug),
      countryCode,
      own,
      residencies,
      pandasById,
    );
  });
  for (const place of mappable) {
    if (place.institutionId && knownInstitutions.has(place.institutionId)) continue;
    items.push(
      toItem(
        "place",
        place.placeId,
        place.slug,
        displayName(place.nameZh, place.nameEn, place.slug),
        place.countryCode ?? null,
        [place],
        residencies,
        pandasById,
      ),
    );
  }
  items.sort((left, right) => right.residentCount - left.residentCount || left.name.localeCompare(right.name, "zh-CN"));

  const groups = [
    { id: "china" as const, title: "中国", items: items.filter((item) => !item.overseas) },
    { id: "overseas" as const, title: "海外", items: items.filter((item) => item.overseas) },
  ].filter((group) => group.items.length > 0);

  return {
    items,
    clusters: clusterWorldPoints(items, (item) => item.point).map((cluster) => ({
      id: cluster.items.map((item) => item.id).join("+"),
      left: (cluster.x / WORLD_WIDTH) * 100,
      top: (cluster.y / WORLD_HEIGHT) * 100,
      residentCount: cluster.items.reduce((total, item) => total + item.residentCount, 0),
      items: cluster.items,
    })),
    groups,
  };
}

/** One place, for the screen a map row opens when the place belongs to no institution. */
export function buildPlacePage(
  slug: string,
  places: readonly MapPlaceInput[],
  institutions: readonly MapInstitutionInput[],
  residencies: readonly MapResidencyInput[],
  pandas: readonly MapPandaInput[],
): PlacePage | null {
  const place = places.find((item) => item.slug === slug);
  if (!place) return null;
  const institution = place.institutionId
    ? institutions.find((item) => item.institutionId === place.institutionId)
    : undefined;
  const pandasById = new Map(pandas.map((panda) => [panda.id, panda]));
  return {
    name: displayName(place.nameZh, place.nameEn, place.slug),
    where: countryLabel(place.countryCode),
    institution: institution
      ? { slug: institution.slug, name: displayName(institution.nameZh, institution.nameEn, institution.slug) }
      : null,
    residents: residentsAt(new Set([place.placeId]), residencies, pandasById),
  };
}
