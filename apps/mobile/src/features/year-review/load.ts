import { useQuery } from "@tanstack/react-query";

import { localToday } from "@/features/engagement/seen";
import { memoryPlaces } from "@/features/on-this-day/load";
import { loadPandaIndex, loadPlaces } from "@/features/pandas/pandas";
import { loadLifeEvents } from "@/lib/public-data";

import { yearReview } from "./year-review";

/** One year's review from the cached index, places and life events; for one panda when `slug` is given. */
export function useYearReview(year: number, slug?: string) {
  const today = localToday();
  return useQuery({
    queryKey: ["year-review", year, slug ?? "", today],
    queryFn: async () => {
      const [pandas, places, events] = await Promise.all([loadPandaIndex(), loadPlaces(), loadLifeEvents()]);
      const panda = slug ? pandas.find((item) => item.slug === slug) : undefined;
      if (slug && !panda) throw new Error("Panda not found");
      return {
        panda: panda ?? null,
        review: yearReview({ year, today, pandas, events, places: memoryPlaces(places), pandaId: panda?.id }),
      };
    },
  });
}
