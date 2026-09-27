import "reflect-metadata";

import { describe, expect, it } from "vitest";
import { PublicCache } from "../src/platform/http/public-cache.decorator.js";

const HEADERS_METADATA = "__headers__";

describe("PublicCache", () => {
  it("keeps browser caching conservative while enabling bounded Vercel CDN caching", () => {
    class FixtureController {
      @PublicCache({ maxAgeSeconds: 60, staleWhileRevalidateSeconds: 30, tags: ["zhipanda-public-read"] })
      public read(this: void) {
        return { ok: true };
      }
    }

    const headers = Reflect.getMetadata(HEADERS_METADATA, FixtureController.prototype.read) as Array<{
      name: string;
      value: string;
    }>;

    expect(headers).toEqual(expect.arrayContaining([
      { name: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      { name: "Vercel-CDN-Cache-Control", value: "public, max-age=60, stale-while-revalidate=30" },
      { name: "Vercel-Cache-Tag", value: "zhipanda-public-read" },
    ]));
  });
});
