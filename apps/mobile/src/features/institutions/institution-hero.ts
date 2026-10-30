import { useEffect, useState } from "react";

import { hasBurnedInMark } from "@/features/today/story-order";
import { api, publicMediaUrl } from "@/lib/api";

export interface HeroPhoto {
  url: string;
  /** Whose photo it is, for the credit line at the foot of the page. */
  credit: string | null;
  pandaName: string;
}

/**
 * The photograph at the top of an institution page: the first resident whose cover carries no
 * agency watermark. Null while loading, offline, or when no resident has a clean photo.
 */
export function useInstitutionHero(residents: { id: string; name: string }[]): HeroPhoto | null {
  const [hero, setHero] = useState<HeroPhoto | null>(null);
  const ids = residents
    .slice(0, 12)
    .map((panda) => panda.id)
    .join(",");
  useEffect(() => {
    if (!ids) return;
    let active = true;
    api
      .GET("/api/v2/panda-covers", { params: { query: { ids } } })
      .then(({ data }) => {
        const covers = new Map((data?.items ?? []).filter((cover) => !hasBurnedInMark(cover)).map((cover) => [cover.pandaId, cover]));
        const panda = residents.find((item) => covers.has(item.id));
        const cover = panda ? covers.get(panda.id) : undefined;
        if (!active || !panda || !cover) return;
        const credit = [cover.attributionText ?? cover.creator, cover.license].filter(Boolean).join("，");
        setHero({ url: publicMediaUrl(cover.objectKey), credit: credit || null, pandaName: panda.name });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // `ids` stands for `residents`: the list is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  return hero;
}
