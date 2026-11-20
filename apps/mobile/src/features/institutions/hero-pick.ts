// Pure picking logic for an institution page's top photo, kept free of React Native so it is unit tested.

export interface CandidateCover {
  pandaId: string;
  fullBleedReady?: boolean;
}

/** Residents asked about at most: the covers call stays one small request. */
const LOOKUP = 24;

/** The residents worth asking the API about: those cleared for full-bleed cover use, in page order. */
export function heroCandidates<T extends { id: string; hasFullBleedCover?: boolean }>(residents: readonly T[]): T[] {
  return residents.filter((panda) => panda.hasFullBleedCover === true).slice(0, LOOKUP);
}

/**
 * The resident whose cover leads the page: the first one, in page order, whose cover is ready for
 * full-bleed use. Null when none qualifies; the page then sets its name on a plain plate.
 */
export function pickInstitutionHero<T extends { id: string }, C extends CandidateCover>(
  residents: readonly T[],
  covers: readonly C[],
): { panda: T; cover: C } | null {
  const clean = new Map(
    covers
      .filter((cover) => cover.fullBleedReady === true)
      .map((cover) => [cover.pandaId, cover]),
  );
  for (const panda of residents) {
    const cover = clean.get(panda.id);
    if (cover) return { panda, cover };
  }
  return null;
}
