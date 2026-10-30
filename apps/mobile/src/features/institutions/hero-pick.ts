// Pure picking logic for an institution page's top photo, kept free of React Native so it is unit tested.
import { CURATED_COVERS } from "../today/curated-covers";
import { hasBurnedInMark, hasCuratedCover, isCuratedCover } from "../today/story-order";

export interface CandidateCover {
  pandaId: string;
  contentSha256: string;
  creator?: string | null;
  attributionText?: string | null;
}

/** Residents asked about at most: the covers call stays one small request. */
const LOOKUP = 24;

/** The residents worth asking the API about: those with a cover reviewed by hand, in page order. */
export function heroCandidates<T extends { id: string }>(
  residents: readonly T[],
  curated: ReadonlyMap<string, string> = CURATED_COVERS,
): T[] {
  return residents.filter((panda) => hasCuratedCover(panda.id, curated)).slice(0, LOOKUP);
}

/**
 * The resident whose cover leads the page: the first one, in page order, whose cover is the very
 * photo reviewed for full-bleed use (no thumbnail, mark or colour cast) and carries no agency
 * watermark. Null when none qualifies; the page then sets its name on a plain plate.
 */
export function pickInstitutionHero<T extends { id: string }, C extends CandidateCover>(
  residents: readonly T[],
  covers: readonly C[],
  curated: ReadonlyMap<string, string> = CURATED_COVERS,
): { panda: T; cover: C } | null {
  const clean = new Map(
    covers
      .filter((cover) => isCuratedCover(cover, curated) && !hasBurnedInMark(cover))
      .map((cover) => [cover.pandaId, cover]),
  );
  for (const panda of residents) {
    const cover = clean.get(panda.id);
    if (cover) return { panda, cover };
  }
  return null;
}
