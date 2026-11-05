import { useQuery } from "@tanstack/react-query";

import { loadCheckins } from "@/features/checkin/checkin";
import { localToday } from "@/features/engagement/seen";
import { type PandaListItem, loadPandaIndex, loadPlaces, placeName } from "@/features/pandas/pandas";
import { useSession } from "@/features/session/session";
import { loadVisits } from "@/features/visits/visits";
import { authedApi } from "@/lib/api";

import { type YearReview, yearReview } from "./year-review";

export interface YearReviewData {
  review: YearReview;
  pandas: ReadonlyMap<string, PandaListItem>;
  placeNames: ReadonlyMap<string, string>;
  /** Pandas met in all (the 图鉴's 点亮) and every published panda. */
  met: number;
  catalog: number;
}

async function loadYearReview(year: number, today: string): Promise<YearReviewData> {
  const [games, seen, visits, checkins, index, places] = await Promise.all([
    authedApi.GET("/api/v2/me/panda-book"),
    authedApi.GET("/api/v2/me/seen-pandas"),
    loadVisits(),
    loadCheckins(today),
    loadPandaIndex(),
    loadPlaces(),
  ]);
  if (!games.data || !seen.data) throw new Error("Year review unavailable");
  const placeNames = new Map(
    [...places].flatMap(([id, place]) => {
      const name = placeName(place);
      return name ? [[id, name] as const] : [];
    }),
  );
  const met = new Set([...games.data.items.map((item) => item.pandaId), ...seen.data.items.map((item) => item.pandaId)]).size;
  return {
    review: yearReview({ year, today, games: games.data.items, seen: seen.data.items, visits, checkins: checkins.days }),
    pandas: new Map(index.map((panda) => [panda.id, panda])),
    placeNames,
    met,
    catalog: index.length,
  };
}

/** The signed-in fan's review of `year`; idle while signed out. */
export function useYearReview(year: number) {
  const { state } = useSession();
  const accountId = state.status === "signedIn" ? state.accountId : null;
  const today = localToday();
  return useQuery({
    queryKey: ["year-review", accountId ?? "", year, today],
    queryFn: () => loadYearReview(year, today),
    enabled: accountId !== null,
  });
}
