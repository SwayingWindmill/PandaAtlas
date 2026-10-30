// Pure picking logic for 今天's story-card photos, kept free of React Native so it is unit tested.
import type { PandaListItem } from "@/features/pandas/pandas";

export interface StoryPhoto {
  pandaId: string;
  name: string;
  url: string;
}

/** A small, stable hash of the day, so every fan sees the same picks on the same day. */
function seedOf(day: string): number {
  let hash = 2166136261;
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Living pandas in a day-seeded order: the candidates for 今天's card photos. */
export function storyCandidates(pandas: PandaListItem[], day: string): PandaListItem[] {
  let state = seedOf(day) || 1;
  const random = () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const items = [...pandas].filter((panda) => !panda.deceased).sort((a, b) => a.id.localeCompare(b.id));
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const held = items[index]!;
    items[index] = items[swap]!;
    items[swap] = held;
  }
  return items;
}

/** The first `count` candidates that have a cover, each a different panda and a different photo. */
export function pickStoryPhotos(
  candidates: PandaListItem[],
  covers: Map<string, string>,
  count: number,
): StoryPhoto[] {
  const used = new Set<string>();
  const picks: StoryPhoto[] = [];
  for (const panda of candidates) {
    const url = covers.get(panda.id);
    if (!url || used.has(url)) continue;
    used.add(url);
    picks.push({ pandaId: panda.id, name: panda.name, url });
    if (picks.length === count) break;
  }
  return picks;
}

/**
 * Sources whose pictures carry a burned-in mark: 新华网 in a corner, or Pandapia's logo along the
 * bottom of its small square crops. A full-bleed card or hero puts its title over the whole photo,
 * so a cover credited to one of them is left out of 今天's cards and institution heroes. The credit
 * is the only signal the API gives; the photo stays on the panda's own page and in lists.
 */
const WATERMARKED_CREDIT = /xinhua|新华|pandapia/i;

export function hasBurnedInMark(cover: { creator?: string | null; attributionText?: string | null }): boolean {
  return WATERMARKED_CREDIT.test(`${cover.creator ?? ""} ${cover.attributionText ?? ""}`);
}
