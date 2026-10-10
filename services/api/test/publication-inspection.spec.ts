import { describe, expect, it } from "vitest";
import {
  pagePublicationChanges,
  summarizePublicationChanges,
} from "../src/modules/publication/application/publication-inspection.port.js";
import type { PublicationChange } from "../src/modules/publication/application/publication-change.port.js";

const changes: PublicationChange[] = [
  { resourceKind: "panda", resourceId: "a", changeType: "changed" },
  { resourceKind: "panda", resourceId: "b", changeType: "added" },
  { resourceKind: "media", resourceId: "c", changeType: "removed" },
];

describe("release membership inspection", () => {
  it("keeps the full counts while returning only the requested concrete resource IDs", () => {
    expect(summarizePublicationChanges(changes)).toEqual([
      { resourceKind: "media", added: 0, changed: 0, removed: 1 },
      { resourceKind: "panda", added: 1, changed: 1, removed: 0 },
    ]);
    expect(pagePublicationChanges(changes, { changeLimit: 2, changeOffset: 0 })).toEqual({
      changeTotal: 3, changeOffset: 0, changeItems: changes.slice(0, 2),
    });
    expect(pagePublicationChanges(changes, { changeLimit: 2, changeOffset: 2 })).toEqual({
      changeTotal: 3, changeOffset: 2, changeItems: [changes[2]],
    });
    expect(pagePublicationChanges(changes, { changeLimit: 2, changeOffset: 4 })).toEqual({
      changeTotal: 3, changeOffset: 4, changeItems: [],
    });
  });
});
