import { describe, expect, it } from "vitest";

import {
  GUEST_PHOTO_SCOPE,
  MAX_VISIT_PHOTOS,
  VISIT_PHOTO_MAX_WIDTH,
  VISIT_PHOTOS_KEY,
  collageLayoutForCount,
  computeResizeWidth,
  getVisitPhotos,
  migrateGuestVisitPhotosInMap,
  parseVisitPhotoMap,
  photoScopeFor,
  removeVisitPhotosInMap,
  setVisitPhotosInMap,
  ticketFilename,
  visitPhotoKey,
} from "./visit-photos-model";

const sample = (id: string, uri = `file:///doc/visit-photos/${id}.jpg`) => ({
  id,
  uri,
  width: 1200,
  height: 900,
  createdAt: "2026-11-29T00:00:00Z",
});

describe("visit-photos-model", () => {
  it("isolates storage key from offline cache prefix and resolves scopes cleanly", () => {
    expect(VISIT_PHOTOS_KEY.startsWith("offline:")).toBe(false);
    expect(photoScopeFor(null)).toBe(GUEST_PHOTO_SCOPE);
    expect(photoScopeFor("")).toBe(GUEST_PHOTO_SCOPE);
    expect(photoScopeFor("acc-1")).toBe("acc-1");
    expect(visitPhotoKey("acc-1", "place-cd", "2026-11-29")).toBe("acc-1:place-cd:2026-11-29");
  });

  it("parses valid entries safely while dropping malformed items and capping at 4 photos", () => {
    expect(parseVisitPhotoMap(null)).toEqual({});
    expect(parseVisitPhotoMap("not-json")).toEqual({});
    const raw = JSON.stringify({
      "acc-1:p1:2026-11-29": [
        sample("a"),
        { bad: true },
        sample("b"),
        sample("c"),
        sample("d"),
        sample("e"),
      ],
      "acc-1:empty:2026-11-29": [{ id: "only-bad", uri: "" }],
    });
    const parsed = parseVisitPhotoMap(raw);
    expect(getVisitPhotos(parsed, "acc-1", "p1", "2026-11-29").map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(parsed["acc-1:p1:2026-11-29"]).toHaveLength(MAX_VISIT_PHOTOS);
    expect(parsed["acc-1:empty:2026-11-29"]).toBeUndefined();
  });

  it("tracks dropped and removed photo URIs safely across shared references", () => {
    const sharedUri = "file:///doc/visit-photos/shared.jpg";
    const key1 = visitPhotoKey("acc-1", "place-1", "2026-11-29");
    const key2 = visitPhotoKey("acc-1", "place-2", "2026-11-29");

    let map = setVisitPhotosInMap({}, key1, [sample("s1", sharedUri), sample("u1")]).next;
    map = setVisitPhotosInMap(map, key2, [sample("s2", sharedUri)]).next;

    // Replacing key1 removes u1's URI from unreferenced output while keeping sharedUri protected by key2.
    const updated = setVisitPhotosInMap(map, key1, []);
    expect(updated.dropped.map((item) => item.id)).toEqual(["u1"]);
    expect(updated.next[key1]).toBeUndefined();

    const removedKey2 = removeVisitPhotosInMap(updated.next, key2);
    expect(removedKey2.removed.map((item) => item.uri)).toEqual([sharedUri]);
    expect(removedKey2.next).toEqual({});
  });

  it("migrates guest photos into account scope without overwriting existing account photos", () => {
    const gKey = visitPhotoKey(GUEST_PHOTO_SCOPE, "place-cd", "2026-11-28");
    const aKey = visitPhotoKey("acc-1", "place-cd", "2026-11-28");
    const initial = {
      [gKey]: [sample("g1"), sample("g2"), sample("g3")],
      [aKey]: [sample("a1"), sample("a2")],
    };

    const migrated = migrateGuestVisitPhotosInMap(initial, "acc-1", [
      { placeId: "place-cd", visitedOn: "2026-11-28" },
      { placeId: "place-unused", visitedOn: "2026-11-20" },
    ]);
    expect(migrated.changed).toBe(true);
    expect(migrated.next[gKey]).toBeUndefined();
    expect(migrated.next[aKey]?.map((p) => p.id)).toEqual(["a1", "a2", "g1", "g2"]);
    expect(migrated.dropped.map((p) => p.id)).toEqual(["g3"]);
  });

  it("computes resize targets, collage layouts, and safe export filenames", () => {
    expect(computeResizeWidth(undefined)).toBeNull();
    expect(computeResizeWidth(800)).toBeNull();
    expect(computeResizeWidth(VISIT_PHOTO_MAX_WIDTH)).toBeNull();
    expect(computeResizeWidth(4032)).toBe(VISIT_PHOTO_MAX_WIDTH);

    expect(collageLayoutForCount(0)).toBe("none");
    expect(collageLayoutForCount(1)).toBe("single");
    expect(collageLayoutForCount(2)).toBe("pair");
    expect(collageLayoutForCount(3)).toBe("triple");
    expect(collageLayoutForCount(4)).toBe("quad");

    expect(ticketFilename("chengdu-research-base", "2026-11-29")).toBe(
      "zhipanda-ticket-chengdu-research-base-2026-11-29.png",
    );
  });
});
