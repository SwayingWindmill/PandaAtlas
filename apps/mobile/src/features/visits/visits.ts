import type { components } from "@zhipanda/api-client";

import { authedApi } from "@/lib/api";

// 到访: a signed-in fan records the day they went to a panda facility, the same place check-ins the website's
// 去过的地点 shows. A visit says only that the fan was there, not that they saw any panda.

export type Visit = components["schemas"]["CheckinDto"];

/** Most recent day first; visits on the same day keep the order they were recorded in. */
export function sortVisits(visits: Visit[]): Visit[] {
  return [...visits].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn) || b.createdAt.localeCompare(a.createdAt));
}

/** The latest recorded day for each place. */
export function lastVisitByPlace(visits: Visit[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const visit of visits) {
    const current = latest.get(visit.placeId);
    if (!current || visit.visitedOn > current) latest.set(visit.placeId, visit.visitedOn);
  }
  return latest;
}

export async function loadVisits(): Promise<Visit[]> {
  const { data } = await authedApi.GET("/api/v2/me/checkins");
  if (!data) throw new Error("Visits unavailable");
  return sortVisits(data.items);
}

export async function recordVisit(placeId: string, visitedOn: string): Promise<Visit> {
  const { data } = await authedApi.POST("/api/v2/me/checkins", { body: { placeId, visitedOn } });
  if (!data) throw new Error("Visit not recorded");
  return data;
}

export async function removeVisit(checkinId: string): Promise<void> {
  const { response } = await authedApi.DELETE("/api/v2/me/checkins/{checkinId}", { params: { path: { checkinId } } });
  if (!response.ok) throw new Error(`Visit not removed (${response.status})`);
}
