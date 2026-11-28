import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearOfflineCache } from "@/lib/offline-cache";

import {
  clearVisitPhotos,
  migrateSyncedGuestVisitPhotos,
  pickAndPrepareVisitPhotos,
  saveVisitPhotos,
  useAllVisitPhotos,
} from "./visit-photos";
import { GUEST_PHOTO_SCOPE, VISIT_PHOTOS_KEY, VISIT_PHOTO_MAX_WIDTH } from "./visit-photos-model";

const state = vi.hoisted(() => ({
  stored: new Map<string, string>(),
  deletedFiles: [] as string[],
  copiedFiles: [] as { src: string; dest: string }[],
  failSecondCopy: false,
  runEffects: false,
  getDelay: null as null | (() => Promise<void>),
}));

const mocks = vi.hoisted(() => ({
  launchImageLibraryAsync: vi.fn(),
  manipulate: vi.fn(),
  resize: vi.fn(),
  renderAsync: vi.fn(),
  saveAsync: vi.fn(),
  releaseContext: vi.fn(),
  releaseImage: vi.fn(),
}));

vi.mock("react", () => ({
  useEffect: (fn: () => void) => {
    if (state.runEffects) fn();
  },
  useMemo: (fn: () => unknown) => fn(),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => {
      const value = state.stored.get(key) ?? null;
      if (state.getDelay) await state.getDelay();
      return value;
    },
    setItem: async (key: string, value: string) => {
      state.stored.set(key, value);
    },
    getAllKeys: async () => [...state.stored.keys()],
    removeMany: async (keys: string[]) => {
      for (const key of keys) state.stored.delete(key);
    },
  },
}));

vi.mock("expo-file-system", () => {
  const DOC_DIR = "file:///documents";
  class MockDirectory {
    uri: string;
    exists = true;
    constructor(...parts: (string | { uri: string })[]) {
      const joined = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/").replace(/\/+/g, "/");
      this.uri = joined.replace("file:/", "file:///");
    }
    create = vi.fn();
  }
  class MockFile {
    uri: string;
    exists = true;
    constructor(...parts: (string | { uri: string })[]) {
      const joined = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/").replace(/\/+/g, "/");
      this.uri = joined.replace("file:/", "file:///");
    }
    async copy(dest: { uri: string }) {
      if (state.failSecondCopy && state.copiedFiles.length >= 1) {
        throw new Error("disk full");
      }
      state.copiedFiles.push({ src: this.uri, dest: dest.uri });
    }
    delete() {
      state.deletedFiles.push(this.uri);
    }
  }
  return {
    Paths: { document: { uri: DOC_DIR } },
    Directory: MockDirectory,
    File: MockFile,
  };
});

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: mocks.launchImageLibraryAsync,
}));

vi.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: mocks.manipulate,
  },
}));

describe("visit-photos runtime store", () => {
  beforeEach(async () => {
    state.stored.clear();
    state.deletedFiles.length = 0;
    state.copiedFiles.length = 0;
    state.failSecondCopy = false;
    state.runEffects = false;
    state.getDelay = null;
    vi.clearAllMocks();

    await clearVisitPhotos("acc-rt", "place-cd", "2026-11-29");
    await clearVisitPhotos(GUEST_PHOTO_SCOPE, "place-cd", "2026-11-28");

    mocks.manipulate.mockImplementation(() => ({
      resize: mocks.resize,
      renderAsync: mocks.renderAsync,
      release: mocks.releaseContext,
    }));
    mocks.renderAsync.mockResolvedValue({
      saveAsync: mocks.saveAsync,
      release: mocks.releaseImage,
    });
    mocks.saveAsync.mockResolvedValue({
      uri: "file:///cache/resized.jpg",
      width: 1200,
      height: 900,
    });
  });

  it("resizes oversized library picks to 1200px width and releases manipulator refs", async () => {
    mocks.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: "file:///tmp/big.heic", width: 4032, height: 3024 },
        { uri: "file:///tmp/small.jpg", width: 800, height: 600 },
      ],
    });

    const result = await pickAndPrepareVisitPhotos(3);
    expect(result).toHaveLength(2);
    expect(mocks.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 3,
      quality: 1,
    });
    expect(mocks.manipulate).toHaveBeenNthCalledWith(1, "file:///tmp/big.heic", { maxWidth: VISIT_PHOTO_MAX_WIDTH });
    expect(mocks.resize).toHaveBeenCalledTimes(1);
    expect(mocks.resize).toHaveBeenCalledWith({ width: VISIT_PHOTO_MAX_WIDTH });
    expect(mocks.manipulate).toHaveBeenNthCalledWith(2, "file:///tmp/small.jpg", undefined);
    expect(mocks.releaseContext).toHaveBeenCalledTimes(2);
    expect(mocks.releaseImage).toHaveBeenCalledTimes(2);
  });

  it("persists native files privately, survives clearOfflineCache, migrates guest photos, and cleans up on removal", async () => {
    const saved = await saveVisitPhotos("acc-rt", "place-cd", "2026-11-29", [
      { id: "p-1", uri: "file:///cache/resized-1.jpg", width: 1200, height: 900, createdAt: "2026-11-29T00:00:00Z" },
    ]);
    expect(saved[0]?.uri).toBe("file:///documents/visit-photos/p-1.jpg");
    expect(state.copiedFiles).toEqual([
      { src: "file:///cache/resized-1.jpg", dest: "file:///documents/visit-photos/p-1.jpg" },
    ]);
    expect(useAllVisitPhotos()["acc-rt:place-cd:2026-11-29"]).toHaveLength(1);

    // Clear offline caches and verify visit-photos:v1 stays untouched.
    state.stored.set("offline:/api/v2/pandas", "[]");
    expect(await clearOfflineCache()).toBe(1);
    expect(state.stored.has(VISIT_PHOTOS_KEY)).toBe(true);

    // Deleting the visit deletes the persisted private JPEG copy.
    await clearVisitPhotos("acc-rt", "place-cd", "2026-11-29");
    expect(state.deletedFiles).toContain("file:///documents/visit-photos/p-1.jpg");
    expect(useAllVisitPhotos()["acc-rt:place-cd:2026-11-29"]).toBeUndefined();

    // Guest check-in photo migrates cleanly into the signed-in account scope.
    await saveVisitPhotos(GUEST_PHOTO_SCOPE, "place-cd", "2026-11-28", [
      { id: "g-1", uri: "file:///documents/visit-photos/g-1.jpg", createdAt: "2026-11-28T00:00:00Z" },
    ]);
    await migrateSyncedGuestVisitPhotos("acc-rt", [{ placeId: "place-cd", visitedOn: "2026-11-28" }]);
    expect(useAllVisitPhotos()[`${GUEST_PHOTO_SCOPE}:place-cd:2026-11-28`]).toBeUndefined();
    expect(useAllVisitPhotos()["acc-rt:place-cd:2026-11-28"]?.map((p) => p.id)).toEqual(["g-1"]);
  });

  it("rolls back copied files on partial copy failure and prevents slow readStoredMap from overwriting migration", async () => {
    state.failSecondCopy = true;
    await expect(
      saveVisitPhotos("acc-rt", "place-cd", "2026-11-29", [
        { id: "c1", uri: "file:///cache/c1.jpg", createdAt: "2026-11-29T00:00:00Z" },
        { id: "c2", uri: "file:///cache/c2.jpg", createdAt: "2026-11-29T00:01:00Z" },
      ]),
    ).rejects.toThrow("disk full");
    expect(state.deletedFiles).toContain("file:///documents/visit-photos/c1.jpg");

    state.failSecondCopy = false;
    state.deletedFiles.length = 0;
    await clearVisitPhotos("acc-rt", "place-cd", "2026-11-28");

    // Reset cache and race a slow initial read against a concurrent guest migration exceeding 4 photos.
    vi.resetModules();
    state.stored.set(
      VISIT_PHOTOS_KEY,
      JSON.stringify({
        "guest:place-cd:2026-11-27": [
          { id: "g1", uri: "file:///documents/visit-photos/g1.jpg", createdAt: "2026-11-27T00:00:00Z" },
          { id: "g2", uri: "file:///documents/visit-photos/g2.jpg", createdAt: "2026-11-27T00:00:00Z" },
          { id: "g3", uri: "file:///documents/visit-photos/g3.jpg", createdAt: "2026-11-27T00:00:00Z" },
        ],
        "acc-rt:place-cd:2026-11-27": [
          { id: "a1", uri: "file:///documents/visit-photos/a1.jpg", createdAt: "2026-11-27T00:00:00Z" },
          { id: "a2", uri: "file:///documents/visit-photos/a2.jpg", createdAt: "2026-11-27T00:00:00Z" },
        ],
      }),
    );

    const freshStore = await import("./visit-photos");
    let releaseRead!: () => void;
    let firstReadBlocked = false;
    state.getDelay = () => {
      if (firstReadBlocked) return Promise.resolve();
      firstReadBlocked = true;
      return new Promise<void>((resolve) => {
        releaseRead = resolve;
      });
    };

    state.runEffects = true;
    freshStore.useAllVisitPhotos();
    state.runEffects = false;

    await freshStore.migrateSyncedGuestVisitPhotos("acc-rt", [{ placeId: "place-cd", visitedOn: "2026-11-27" }]);
    releaseRead();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const finalMap = freshStore.useAllVisitPhotos();
    expect(finalMap["guest:place-cd:2026-11-27"]).toBeUndefined();
    expect(finalMap["acc-rt:place-cd:2026-11-27"]?.map((p) => p.id)).toEqual(["a1", "a2", "g1", "g2"]);
    expect(state.deletedFiles).toContain("file:///documents/visit-photos/g3.jpg");
  });
});
