import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { api } from "@/lib/api";
import { fetchLifeEvents, fetchResidencies } from "@/lib/public-data";

import { type WeekDigest, weekDigest } from "./week";

export interface Week {
  digest: WeekDigest | null;
  pandas: Map<string, PandaListItem>;
}

/** Releases are a few a week; this many reaches well past seven days, rollbacks included. */
const UPDATES_READ = 30;

/**
 * This week's releases and the lists that map them to pandas, read afresh each time so a release published
 * while the app is open counts. The panda index is the set of pandas on record now.
 */
export async function loadWeek(now = new Date()): Promise<Week> {
  const [updates, residencies, events, index] = await Promise.all([
    api.GET("/api/v2/updates", { params: { query: { limit: UPDATES_READ } } }),
    fetchResidencies(),
    fetchLifeEvents(),
    loadPandaIndex(),
  ]);
  if (!updates.data) throw new Error("Updates unavailable");
  const pandas = new Map(index.map((panda) => [panda.id, panda]));
  const known = new Map(index.map((panda) => [panda.id, panda.birthDate]));
  return { digest: weekDigest(updates.data, { residencies, events }, known, now), pandas };
}
