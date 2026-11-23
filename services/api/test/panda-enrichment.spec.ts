import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PandaEnrichmentError, parsePandaEnrichment } from "../src/modules/panda/application/panda-enrichment.js";

const shippedDocument: unknown = JSON.parse(
  readFileSync(new URL("../../../data/curation/panda-enrichment/top-pandas.json", import.meta.url), "utf8"),
);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("panda-enrichment parser", () => {
  it("accepts the shipped data/curation/panda-enrichment/top-pandas.json catalog", () => {
    const parsed = parsePandaEnrichment(shippedDocument);
    expect(parsed.version).toBe("2026.11.22.1");
    expect(parsed.items.length).toBeGreaterThanOrEqual(30);
    const leBao = parsed.items.find((item) => item.pandaSlug === "le-bao");
    expect(leBao?.facts.find((fact) => fact.fieldKey === "birth_date")?.value).toBe("2012-07-28");
    const heYe = parsed.items.find((item) => item.pandaSlug === "he-ye-chengdu");
    expect(heYe?.facts.find((fact) => fact.fieldKey === "sex")?.value).toBe("female");
  });

  it("rejects non-https URLs, search redirect URLs, and unknown source keys", () => {
    const httpDoc = clone(shippedDocument) as { sources: Array<{ url: string }> };
    httpDoc.sources[0]!.url = "http://example.com/report";
    expect(() => parsePandaEnrichment(httpDoc)).toThrow(PandaEnrichmentError);

    const redirectDoc = clone(shippedDocument) as { sources: Array<{ url: string }> };
    redirectDoc.sources[0]!.url = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc";
    expect(() => parsePandaEnrichment(redirectDoc)).toThrow(/search redirect/);

    const missingKeyDoc = clone(shippedDocument) as { items: Array<{ facts: Array<{ sourceKeys: string[] }> }> };
    missingKeyDoc.items[0]!.facts[0]!.sourceKeys = ["no-such-source"];
    expect(() => parsePandaEnrichment(missingKeyDoc)).toThrow(/unknown source key/);
  });

  it("rejects mismatched startPrecision, invalid death_date ordering, and invalid lineage", () => {
    const badPrecision = {
      version: "2026.11.22.1",
      updatedAt: "2026-11-22T18:00:00+08:00",
      sources: [
        {
          key: "official-source",
          publisher: "Official Zoo",
          title: "Profile",
          url: "https://example.org/profile",
          lastVerifiedOn: "2026-11-22",
          languageTag: "en",
          accessState: "accessible",
        },
      ],
      items: [
        {
          pandaSlug: "demo-panda",
          currentResidency: {
            placeSlug: "demo-zoo",
            startOn: "2020-01-01",
            startPrecision: "unknown",
            status: "confirmed",
            sourceKeys: ["official-source"],
          },
        },
      ],
    };
    expect(() => parsePandaEnrichment(badPrecision)).toThrow(/unknown/);

    const badDeath = clone(badPrecision) as unknown as {
      items: Array<Record<string, unknown>>;
    };
    badDeath.items[0] = {
      pandaSlug: "demo-panda",
      facts: [
        {
          fieldKey: "birth_date",
          value: "2010-05-01",
          certainty: "confirmed",
          lastVerifiedOn: "2026-11-22",
          sourceKeys: ["official-source"],
        },
        {
          fieldKey: "death_date",
          value: "2009-01-01",
          certainty: "confirmed",
          lastVerifiedOn: "2026-11-22",
          sourceKeys: ["official-source"],
        },
      ],
    };
    expect(() => parsePandaEnrichment(badDeath)).toThrow(/death_date/);

    const selfParent = clone(badPrecision) as unknown as {
      items: Array<Record<string, unknown>>;
    };
    selfParent.items[0] = {
      pandaSlug: "demo-panda",
      lineage: {
        mother: { parentSlug: "demo-panda", status: "confirmed", sourceKeys: ["official-source"] },
      },
    };
    expect(() => parsePandaEnrichment(selfParent)).toThrow(/cannot equal pandaSlug/);

    const sameParents = clone(badPrecision) as unknown as {
      items: Array<Record<string, unknown>>;
    };
    sameParents.items[0] = {
      pandaSlug: "demo-panda",
      lineage: {
        mother: { parentSlug: "parent-a", status: "confirmed", sourceKeys: ["official-source"] },
        father: { parentSlug: "parent-a", status: "confirmed", sourceKeys: ["official-source"] },
      },
    };
    expect(() => parsePandaEnrichment(sameParents)).toThrow(/cannot match/);

    const deceasedResidency = clone(badPrecision) as unknown as {
      items: Array<Record<string, unknown>>;
    };
    deceasedResidency.items[0] = {
      pandaSlug: "demo-panda",
      facts: [
        {
          fieldKey: "life_status",
          value: "deceased",
          certainty: "confirmed",
          lastVerifiedOn: "2026-11-22",
          sourceKeys: ["official-source"],
        },
      ],
      currentResidency: {
        placeSlug: "demo-zoo",
        startOn: "2020-01-01",
        startPrecision: "day",
        status: "confirmed",
        sourceKeys: ["official-source"],
      },
    };
    expect(() => parsePandaEnrichment(deceasedResidency)).toThrow(/deceased/);
  });
});
