import { api } from "@/lib/api";
import { displayName, pandaBirthDate, pandaIsDeceased } from "@/lib/panda";
import { localToday } from "@/features/engagement/seen";
import { pandaMilestones } from "@/features/milestones/milestones";
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
  const { panda, relatives, lineage, residencies, events, evidence } = detail.data;
  const deathDate = panda.facts.find((fact) => fact.fieldKey === "death_date")?.value;
  const birthDate = pandaBirthDate(panda);
  const relative = new Map(relatives.map((item) => [item.pandaId, item]));
  // 里程碑 from the record: the cub days and birthdays from the birth date, and becoming a parent from the
  // family links, each with the sources of the facts it is worked out from.
  const counted = pandaMilestones({
    birthDate,
    deathDate: typeof deathDate === "string" ? deathDate : null,
    today: localToday(),
    birthSourceIds:
      events.find(
        (event) =>
          event.eventType === "birth" &&
          event.eventStatus === "completed" &&
          event.occurredOn === birthDate &&
          event.participantIds.includes(panda.pandaId),
      )?.sourceIds ?? [],
    children: lineage
      .filter((link) => link.parentId === panda.pandaId)
      .flatMap((link) => {
        const child = relative.get(link.childId);
        if (!child) return [];
        return [
          {
            id: child.pandaId,
            name: displayName(child),
            birthDate: pandaBirthDate(child),
            role: link.parentRole,
            sourceIds: link.sourceIds,
          },
        ];
      }),
  });
  const timeline = buildTimeline({
    events,
    residencies,
    evidence,
    pandaId: panda.pandaId,
    place: (id) => placeName(id ? places.get(id) : undefined),
    birthDate,
    deathDate: typeof deathDate === "string" ? deathDate : null,
    counted,
  });
  return { ...timeline, slug: panda.canonicalSlug, name: displayName(panda), deceased: pandaIsDeceased(panda) };
}
