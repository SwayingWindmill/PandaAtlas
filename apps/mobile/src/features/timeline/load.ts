import { api } from "@/lib/api";
import { displayName, pandaBirthDate, pandaIsDeceased } from "@/lib/panda";
import { loadPlaces, placeName } from "@/features/pandas/pandas";

import { type Timeline, buildTimeline } from "./timeline";

export interface PandaTimeline extends Timeline {
  slug: string;
  name: string;
  deceased: boolean;
}

export async function loadTimeline(slug: string): Promise<PandaTimeline> {
  const [detail, places] = await Promise.all([
    api.GET("/api/v2/pandas/{slug}", { params: { path: { slug } } }),
    loadPlaces(),
  ]);
  if (!detail.data) throw new Error(`Panda ${slug} unavailable`);
  const { panda, residencies, events, evidence } = detail.data;
  const deathDate = panda.facts.find((fact) => fact.fieldKey === "death_date")?.value;
  const timeline = buildTimeline({
    events,
    residencies,
    evidence,
    pandaId: panda.pandaId,
    place: (id) => placeName(id ? places.get(id) : undefined),
    birthDate: pandaBirthDate(panda),
    deathDate: typeof deathDate === "string" ? deathDate : null,
  });
  return { ...timeline, slug: panda.canonicalSlug, name: displayName(panda), deceased: pandaIsDeceased(panda) };
}
