import { queryOptions } from "@tanstack/react-query";

import { type GameEntry, type SeenEntry, buildLifeList } from "@/features/book/book";
import { loadGuestGames, loadGuestSeen, loadGuestVisits } from "@/features/engagement/guest-store";
import { type PandaListItem, loadPandaIndex, loadPlaces, placeName } from "@/features/pandas/pandas";
import { type Visit, loadVisits } from "@/features/visits/visits";
import { authedApi } from "@/lib/api";

import { type PersonalMilestone, personalMilestones } from "./milestones";

type PlacesMap = Awaited<ReturnType<typeof loadPlaces>>;

function assembleMilestones(
  games: GameEntry[],
  seen: SeenEntry[],
  visits: Visit[],
  index: PandaListItem[],
  places: PlacesMap,
): PersonalMilestone[] {
  const pandas = new Map(index.map((panda) => [panda.id, panda]));
  return personalMilestones({
    entries: buildLifeList(games, seen).entries,
    visits,
    panda: (id) => pandas.get(id),
    place: (id) => {
      const place = places.get(id);
      return place ? { name: placeName(place), slug: place.slug } : undefined;
    },
  });
}

export function milestonesQueryOptions(accountId: string) {
  return queryOptions({ queryKey: ["private", accountId, "milestones"], queryFn: loadMilestones, staleTime: 0 });
}

export function guestMilestonesQueryOptions() {
  return queryOptions({
    queryKey: ["guest", "milestones"],
    queryFn: loadGuestMilestones,
    staleTime: 0,
    networkMode: "always",
  });
}

/** The fan's 里程碑, newest first, from the same records and numbering as the 图鉴 and 去过的地点. */
export async function loadMilestones(): Promise<PersonalMilestone[]> {
  const [games, seen, visits, index, places] = await Promise.all([
    authedApi.GET("/api/v2/me/panda-book"),
    authedApi.GET("/api/v2/me/seen-pandas"),
    loadVisits(),
    loadPandaIndex(),
    loadPlaces(),
  ]);
  if (!games.data || !seen.data) throw new Error("Milestones unavailable");
  return assembleMilestones(games.data.items, seen.data.items, visits, index, places);
}

/** Local guest milestones calculated from AsyncStorage + public catalog. */
export async function loadGuestMilestones(): Promise<PersonalMilestone[]> {
  const [games, seenMap, visits, index, places] = await Promise.all([
    loadGuestGames(),
    loadGuestSeen(),
    loadGuestVisits(),
    loadPandaIndex(),
    loadPlaces(),
  ]);
  const seen: SeenEntry[] = Object.entries(seenMap).map(([pandaId, entry]) => ({
    pandaId,
    seenOn: entry.seenOn,
    placeId: entry.placeId ?? null,
    firstSeenAt: entry.firstSeenAt,
  }));
  return assembleMilestones(games, seen, visits, index, places);
}
