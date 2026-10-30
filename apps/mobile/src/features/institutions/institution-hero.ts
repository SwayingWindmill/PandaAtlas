import { useEffect, useState } from "react";

import { api, publicMediaUrl } from "@/lib/api";

import { heroCandidates, pickInstitutionHero } from "./hero-pick";

export interface HeroPhoto {
  url: string;
  /** Whose photo it is, for the credit line at the foot of the page. */
  credit: string | null;
  pandaName: string;
}

/**
 * The photograph at the top of an institution page, drawn only from curated covers. `undefined`
 * while the covers are still being looked up; null when no resident has one or the call failed,
 * so the page sets its name on a plain plate instead.
 */
export function useInstitutionHero(residents: { id: string; name: string }[] | null): HeroPhoto | null | undefined {
  const [found, setFound] = useState<{ ids: string; hero: HeroPhoto | null } | null>(null);
  const candidates = heroCandidates(residents ?? []);
  const ids = candidates.map((panda) => panda.id).join(",");
  useEffect(() => {
    if (!ids) return;
    let active = true;
    api
      .GET("/api/v2/panda-covers", { params: { query: { ids } } })
      .then(({ data }) => {
        if (!active) return;
        const pick = pickInstitutionHero(candidates, data?.items ?? []);
        if (!pick) {
          setFound({ ids, hero: null });
          return;
        }
        const { panda, cover } = pick;
        const credit = [cover.attributionText ?? cover.creator, cover.license].filter(Boolean).join("，");
        setFound({
          ids,
          hero: { url: publicMediaUrl(cover.objectKey), credit: credit || null, pandaName: panda.name },
        });
      })
      .catch(() => {
        if (active) setFound({ ids, hero: null });
      });
    return () => {
      active = false;
    };
    // `ids` stands for `candidates`: the list is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
  if (residents === null) return undefined;
  if (!ids) return null;
  return found?.ids === ids ? found.hero : undefined;
}
