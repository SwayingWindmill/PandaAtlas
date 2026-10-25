import { describe, expect, it } from "vitest";

import {
  assertFacilityVisitGuide,
  assertInstitutionProfile,
  type FacilityVisitGuide,
  type InstitutionProfile,
} from "../src/modules/places/application/visitor-content.js";

const profile: InstitutionProfile = {
  kind: "zoo",
  summary: { zh: "示例", en: "Sample" },
  websiteUrl: "https://zoo.example/",
  liveCamUrl: "https://zoo.example/cam",
  verifiedOn: "2026-10-23",
  sourceUrls: ["https://zoo.example/pandas"],
};

const guide: FacilityVisitGuide = {
  openingHours: { en: "9 to 5" },
  tips: [{ topic: "best_time", text: { zh: "早上去" } }],
  verifiedOn: "2026-10-23",
  sourceUrls: ["https://zoo.example/visit"],
};

function codeOf(run: () => void): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe("visitor content", () => {
  it("accepts a sourced profile and guide, and absent content", () => {
    expect(() => assertInstitutionProfile(profile)).not.toThrow();
    expect(() => assertFacilityVisitGuide(guide)).not.toThrow();
    expect(() => assertInstitutionProfile(undefined)).not.toThrow();
    expect(() => assertFacilityVisitGuide(undefined)).not.toThrow();
  });

  it("rejects unknown kinds, plain http links and unsourced profiles", () => {
    expect(codeOf(() => assertInstitutionProfile({ ...profile, kind: "aquarium" as never }))).toBe("places.institutionKind");
    expect(codeOf(() => assertInstitutionProfile({ ...profile, liveCamUrl: "http://zoo.example/cam" }))).toBe("places.visitorUrl");
    expect(codeOf(() => assertInstitutionProfile({ ...profile, sourceUrls: [] }))).toBe("places.visitorSources");
    expect(codeOf(() => assertInstitutionProfile({ ...profile, verifiedOn: "Oct 2026" }))).toBe("places.visitorVerifiedOn");
  });

  it("rejects empty or overlong text and unknown tip topics", () => {
    expect(codeOf(() => assertFacilityVisitGuide({ ...guide, admission: {} }))).toBe("places.visitorTextEmpty");
    expect(codeOf(() => assertFacilityVisitGuide({ ...guide, pandaArea: { en: "x".repeat(601) } }))).toBe("places.visitorTextLength");
    expect(
      codeOf(() => assertFacilityVisitGuide({ ...guide, tips: [{ topic: "food" as never, text: { en: "Snacks" } }] })),
    ).toBe("places.visitTipTopic");
  });
});
