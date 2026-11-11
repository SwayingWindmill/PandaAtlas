import { queryOptions } from "@tanstack/react-query";

import { loadInstitutionList } from "@/features/institutions/institutions";
import { type PandaListItem, loadPandaIndex, loadPlaces } from "@/features/pandas/pandas";
import { loadResidencies } from "@/lib/public-data";

import { type MapView, type PlacePage, buildMapView, buildPlacePage } from "./model";

function pandasOf(items: PandaListItem[]) {
  return items.map((panda) => ({ id: panda.id, slug: panda.slug, name: panda.name }));
}

/** The map, from the release-wide lists the public client keeps for offline use. */
export async function loadMapView(): Promise<MapView> {
  const [institutions, places, residencies, pandas] = await Promise.all([
    loadInstitutionList(),
    loadPlaces(),
    loadResidencies(),
    loadPandaIndex(),
  ]);
  return buildMapView(institutions, [...places.values()], residencies, pandasOf(pandas));
}

/** The map's places, shared by the 找熊猫 thumbnail and the map screen. */
export function mapViewQueryOptions() {
  return queryOptions({ queryKey: ["public", "map-view"], staleTime: 300_000, networkMode: "always", queryFn: loadMapView });
}

/** A place that belongs to no institution. Null when the release has no such slug. */
export async function loadPlacePage(slug: string): Promise<PlacePage | null> {
  const [institutions, places, residencies, pandas] = await Promise.all([
    loadInstitutionList(),
    loadPlaces(),
    loadResidencies(),
    loadPandaIndex(),
  ]);
  return buildPlacePage(slug, [...places.values()], institutions, residencies, pandasOf(pandas));
}
