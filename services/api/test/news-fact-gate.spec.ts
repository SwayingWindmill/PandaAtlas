import { describe, expect, it } from "vitest";
import { evaluateFactCandidate } from "../src/modules/news/application/news-fact-gate.js";
import type { PublicPandaSummary, PublicResidencySummary } from "../src/modules/public-read/application/public-read.application.js";

const PANDAS: PublicPandaSummary[] = [
  {
    pandaId: "p-1",
    canonicalSlug: "he-hua-chengdu",
    legacySlugs: [],
    names: [{ languageTag: "zh-CN", nameKind: "primary", value: "和花", isPrimary: true }],
    facts: [
      {
        fieldKey: "death_date",
        value: "2026-01-10",
        status: "verified",
        lastVerifiedOn: "2026-01-11",
        conclusionVersion: 1,
      },
    ],
  },
];

const RESIDENCIES: PublicResidencySummary[] = [
  {
    residencyId: "res-1",
    pandaId: "p-1",
    placeId: "pl-1",
    residencyType: "primary",
    startOn: "2020-07-04",
    startPrecision: "day",
    status: "current",
    sourceIds: [],
  },
];

describe("evaluateFactCandidate", () => {
  it("keeps T1 eligible institution fact candidates locked in pending_review for human moderation", () => {
    const result = evaluateFactCandidate({
      sourceTier: "institution",
      publishedAtIso: "2026-11-28T03:00:00.000Z",
      scope: "single",
      factChange: {
        kind: "transfer",
        phase: "announced",
        date: "2026-11-28",
        toPlace: "北京动物园",
      },
      evidenceQuote: "和花将于近期转运至北京动物园。",
      resolution: {
        institution: { institutionId: "inst-cd", slug: "chengdu-research-base", name: "成都基地" },
        toInstitution: { institutionId: "inst-bj", slug: "beijing-zoo", name: "北京动物园" },
        pandas: [
          {
            pandaId: "p-1",
            canonicalSlug: "he-hua-chengdu",
            name: "和花",
            institutionIds: new Set(["inst-cd"]),
          },
        ],
        unresolvedPandaNames: [],
        ambiguousPandaNames: [],
      },
      allPandas: PANDAS,
      allResidencies: RESIDENCIES,
      rawPandaNames: ["和花"],
    });

    expect(result).toMatchObject({
      candidateKey: "transfer:he-hua-chengdu:beijing-zoo:2026-11",
      kind: "transfer",
      phase: "announced",
      gateStatus: "eligible_institution_source",
      reviewState: "pending_review",
    });
  });

  it("excludes proposed naming votes and composite summaries from fact candidates", () => {
    const proposed = evaluateFactCandidate({
      sourceTier: "institution",
      publishedAtIso: "2026-11-28T03:00:00.000Z",
      scope: "single",
      factChange: { kind: "naming", namingStatus: "proposed", date: "2026-11-28" },
      evidenceQuote: "现开启征名投票",
      resolution: {
        institution: { institutionId: "inst-cd", slug: "chengdu-research-base", name: "成都基地" },
        toInstitution: undefined,
        pandas: [],
        unresolvedPandaNames: [],
        ambiguousPandaNames: [],
      },
      allPandas: PANDAS,
      allResidencies: RESIDENCIES,
      rawPandaNames: [],
    });
    expect(proposed).toBeUndefined();

    const composite = evaluateFactCandidate({
      sourceTier: "institution",
      publishedAtIso: "2026-11-28T03:00:00.000Z",
      scope: "composite",
      factChange: { kind: "death", date: "2026-11-28" },
      evidenceQuote: "盘点今年多只大熊猫动态",
      resolution: {
        institution: undefined,
        toInstitution: undefined,
        pandas: [],
        unresolvedPandaNames: [],
        ambiguousPandaNames: [],
      },
      allPandas: PANDAS,
      allResidencies: RESIDENCIES,
      rawPandaNames: ["和花"],
    });
    expect(composite).toBeUndefined();
  });

  it("flags conflicts and marks reports older than 30 days as insufficient_source", () => {
    const conflict = evaluateFactCandidate({
      sourceTier: "institution",
      publishedAtIso: "2026-11-28T03:00:00.000Z",
      scope: "single",
      factChange: { kind: "death", date: "2026-11-28" },
      evidenceQuote: "离世公告",
      resolution: {
        institution: { institutionId: "inst-cd", slug: "chengdu-research-base", name: "成都基地" },
        toInstitution: undefined,
        pandas: [{ pandaId: "p-1", canonicalSlug: "he-hua-chengdu", name: "和花", institutionIds: new Set(["inst-cd"]) }],
        unresolvedPandaNames: [],
        ambiguousPandaNames: [],
      },
      allPandas: PANDAS,
      allResidencies: RESIDENCIES,
      rawPandaNames: ["和花"],
    });
    expect(conflict?.gateStatus).toBe("conflict");

    const delayedTransfer = evaluateFactCandidate({
      sourceTier: "institution",
      publishedAtIso: "2026-11-28T03:00:00.000Z",
      scope: "single",
      factChange: { kind: "transfer", phase: "completed", date: "2026-10-01", toPlace: "北京动物园" },
      evidenceQuote: "已于10月1日抵达北京动物园。",
      resolution: {
        institution: { institutionId: "inst-bj", slug: "beijing-zoo", name: "北京动物园" },
        toInstitution: { institutionId: "inst-bj", slug: "beijing-zoo", name: "北京动物园" },
        pandas: [{ pandaId: "p-1", canonicalSlug: "he-hua-chengdu", name: "和花", institutionIds: new Set(["inst-cd"]) }],
        unresolvedPandaNames: [],
        ambiguousPandaNames: [],
      },
      allPandas: PANDAS,
      allResidencies: RESIDENCIES,
      rawPandaNames: ["和花"],
    });
    expect(delayedTransfer?.gateStatus).toBe("insufficient_source");
    expect(delayedTransfer?.reviewState).toBe("pending_review");

    const nonResidentNaming = evaluateFactCandidate({
      sourceTier: "institution",
      publishedAtIso: "2026-11-28T03:00:00.000Z",
      scope: "single",
      factChange: { kind: "naming", namingStatus: "official", date: "2026-11-28" },
      evidenceQuote: "正式命名为和花。",
      resolution: {
        institution: { institutionId: "inst-bj", slug: "beijing-zoo", name: "北京动物园" },
        toInstitution: undefined,
        pandas: [{ pandaId: "p-1", canonicalSlug: "he-hua-chengdu", name: "和花", institutionIds: new Set(["inst-cd"]) }],
        unresolvedPandaNames: [],
        ambiguousPandaNames: [],
      },
      allPandas: PANDAS,
      allResidencies: RESIDENCIES,
      rawPandaNames: ["和花"],
    });
    expect(nonResidentNaming?.gateStatus).toBe("insufficient_source");
    expect(nonResidentNaming?.reviewState).toBe("pending_review");
  });
});
