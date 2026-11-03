export interface PlaceReferenceCandidate {
  placeId: string;
  slug: string;
  legacySlugs?: string[];
}

/**
 * The place an id or slug names. A merged duplicate's old slug finds the place it was merged
 * into, so old links still open the right page (the page then redirects to the current slug).
 */
export function findPlaceByReference<T extends PlaceReferenceCandidate>(places: readonly T[], input: string): T | undefined {
  const reference = input.trim();
  return places.find((place) => place.placeId === reference || place.slug === reference)
    ?? places.find((place) => place.legacySlugs?.includes(reference));
}
