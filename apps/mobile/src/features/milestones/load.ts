import { buildLifeList } from "@/features/book/book";
import { loadPandaIndex, loadPlaces, placeName } from "@/features/pandas/pandas";
import { loadVisits } from "@/features/visits/visits";
import { authedApi } from "@/lib/api";

import { type PersonalMilestone, personalMilestones } from "./milestones";

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
  const pandas = new Map(index.map((panda) => [panda.id, panda]));
  return personalMilestones({
    entries: buildLifeList(games.data.items, seen.data.items).entries,
    visits,
    panda: (id) => pandas.get(id),
    place: (id) => {
      const place = places.get(id);
      return place ? { name: placeName(place), slug: place.slug } : undefined;
    },
  });
}
