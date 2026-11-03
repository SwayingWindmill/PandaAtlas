import { useEffect, useState } from "react";

import { loadPandaIndex } from "@/features/pandas/pandas";
import {
  type StoryPhoto,
  hasBurnedInMark,
  hasCuratedCover,
  isCuratedCover,
  pickStoryPhotos,
  storyCandidates,
} from "@/features/today/story-order";
import { api, publicMediaUrl } from "@/lib/api";

export type { StoryPhoto };

// The endpoint takes up to 50 ids. Candidates are already limited to reviewed covers, so nearly all
// of them come back usable.
const LOOKAHEAD = 50;

/**
 * Full-bleed photos for story cards, explore cards and the signed-out previews: one different panda
 * per card, drawn only from covers reviewed by hand (no thumbnails, burned-in marks or colour casts).
 * Empty while loading or offline.
 */
export function useStoryPhotos(day: string, count: number): StoryPhoto[] {
  const [photos, setPhotos] = useState<StoryPhoto[]>([]);
  useEffect(() => {
    let active = true;
    loadPandaIndex()
      .then(async (pandas) => {
        const candidates = storyCandidates(pandas, day)
          .filter((panda) => hasCuratedCover(panda.id))
          .slice(0, LOOKAHEAD);
        const { data } = await api.GET("/api/v2/panda-covers", {
          params: { query: { ids: candidates.map((panda) => panda.id).join(",") } },
        });
        const covers = new Map(
          (data?.items ?? [])
            .filter((cover) => isCuratedCover(cover) && !hasBurnedInMark(cover))
            .map((cover) => [cover.pandaId, publicMediaUrl(cover.objectKey)]),
        );
        if (active) setPhotos(pickStoryPhotos(candidates, covers, count));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [day, count]);
  return photos;
}
