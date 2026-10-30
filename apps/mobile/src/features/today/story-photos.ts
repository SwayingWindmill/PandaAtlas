import { useEffect, useState } from "react";

import { loadPandaIndex } from "@/features/pandas/pandas";
import { type StoryPhoto, pickStoryPhotos, storyCandidates } from "@/features/today/story-order";
import { api, publicMediaUrl } from "@/lib/api";

export type { StoryPhoto };

const LOOKAHEAD = 40;

/** Photos for 今天's story cards, one different panda per card. Empty while loading or offline. */
export function useStoryPhotos(day: string, count: number): StoryPhoto[] {
  const [photos, setPhotos] = useState<StoryPhoto[]>([]);
  useEffect(() => {
    let active = true;
    loadPandaIndex()
      .then(async (pandas) => {
        const candidates = storyCandidates(pandas, day).slice(0, LOOKAHEAD);
        const { data } = await api.GET("/api/v2/panda-covers", {
          params: { query: { ids: candidates.map((panda) => panda.id).join(",") } },
        });
        const covers = new Map((data?.items ?? []).map((cover) => [cover.pandaId, publicMediaUrl(cover.objectKey)]));
        if (active) setPhotos(pickStoryPhotos(candidates, covers, count));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [day, count]);
  return photos;
}
