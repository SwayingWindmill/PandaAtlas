import { describe, expect, it } from "vitest";

import {
  type OfflinePackManifest,
  estimatePackSummary,
  formatByteSize,
  keysToDeleteOnPackRemoval,
  offlinePackPercent,
} from "./offline-pack-model";

const sample = (slug: string, pinnedKeys: string[]): OfflinePackManifest => ({
  slug,
  name: slug,
  downloadedAt: "2026-11-28T10:00:00Z",
  pandaCount: 17,
  photoCount: 14,
  jsonBytes: 204 * 1024,
  pinnedKeys,
});

describe("offline-pack-model", () => {
  it("formats byte sizes cleanly", () => {
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(204 * 1024)).toBe("204 KB");
    expect(formatByteSize(1.7 * 1024 * 1024)).toBe("1.7 MB");
  });

  it("only removes pinned keys not shared by any other downloaded base pack", () => {
    const manifests: Record<string, OfflinePackManifest> = {
      chengdu: sample("chengdu", [
        "offline:/api/v2/institutions/chengdu",
        "offline:/api/v2/pandas/shared-panda",
        "offline:/api/v2/pandas/chengdu-only",
      ]),
      beijing: sample("beijing", [
        "offline:/api/v2/institutions/beijing",
        "offline:/api/v2/pandas/shared-panda",
      ]),
    };
    expect(keysToDeleteOnPackRemoval("chengdu", manifests)).toEqual([
      "offline:/api/v2/institutions/chengdu",
      "offline:/api/v2/pandas/chengdu-only",
    ]);
    expect(keysToDeleteOnPackRemoval("missing", manifests)).toEqual([]);
  });

  it("summarizes pack counts and computes bounded phase progress", () => {
    expect(estimatePackSummary(sample("chengdu", []))).toBe("17 只档案 204 KB　14 张封面已存本机");
    expect(offlinePackPercent({ phase: "index", done: 4, total: 8 })).toBe(10);
    expect(offlinePackPercent({ phase: "pandas", done: 17, total: 17 })).toBe(65);
    expect(offlinePackPercent({ phase: "photos", done: 7, total: 14 })).toBe(88);
  });
});
